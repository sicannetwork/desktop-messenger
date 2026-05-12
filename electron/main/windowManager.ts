// FILE: electron/main/windowManager.ts
import {
  BrowserWindow,
  app,
  screen,
  nativeImage,
  shell,
} from "electron";
import path from "path";
import { getSetting, setSetting } from "./store";
import { IPC, WindowStatePayload } from "../../shared/ipc-types";
import { logger } from "./logger";

const PRELOAD_PATH  = path.join(__dirname, "../preload/index.js");
const DEV_URL       = "http://localhost:5173";
// ── FIX: Do NOT build file:// URLs with path.join on Windows — backslashes
//        produce a malformed URL that Electron silently fails to load.
//        We store the raw filesystem path and call loadFile() instead.
const PROD_FILE_PATH = path.join(__dirname, "../../../dist/index.html");
const isDev          = process.env.NODE_ENV === "development";

logger.info(`[windowManager] isDev=${isDev}`);
logger.info(`[windowManager] PRELOAD_PATH=${PRELOAD_PATH}`);
logger.info(`[windowManager] PROD_FILE_PATH=${PROD_FILE_PATH}`);

let mainWindow: BrowserWindow | null = null;

/** Returns the singleton main window, creating it if necessary. */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createMainWindow(): BrowserWindow {
  const bounds       = getSetting("windowBounds");
  const wasMaximized = getSetting("windowMaximized");

  // Clamp saved bounds to currently connected monitors.
  const safeBounds = ensureVisibleOnDisplay(bounds);

  mainWindow = new BrowserWindow({
    x:             safeBounds.x,
    y:             safeBounds.y,
    width:         safeBounds.width,
    height:        safeBounds.height,
    minWidth:      800,
    minHeight:     600,
    frame:         false,           // Custom frameless title bar
    transparent:   false,
    backgroundColor: "#0a0a0a",    // Avoids white flash on load
    show:          false,           // Shown after content ready (splash strategy)
    icon:          getAppIcon(),
    webPreferences: {
      preload:              PRELOAD_PATH,
      contextIsolation:     true,
      nodeIntegration:      false,
      sandbox:              false,          // Must be false to allow <webview> tag
      webviewTag:           true,           // Required for <webview> to render
      spellcheck:           getSetting("spellcheck"),
      // ── FIX: Always enable devTools so you can Ctrl+Shift+I in production
      //         to inspect a blank-screen renderer error.
      devTools:             true,
    },
    titleBarStyle:   "hidden",
    // Windows-specific title bar overlay (Win11 Mica-style buttons)
    titleBarOverlay: false,
  });

  if (wasMaximized) {
    mainWindow.maximize();
  }

  // ── Load the renderer ─────────────────────────────────────────────────────
  // In dev: load from Vite dev server.
  // In prod: use loadFile() — the Electron-safe API for file:// loading on
  //          Windows.  Building "file://" + path.join() produces backslashes
  //          on Windows which makes a malformed URL and yields a blank window.
  if (isDev) {
    logger.info(`[windowManager] Loading DEV URL: ${DEV_URL}`);
    mainWindow.loadURL(DEV_URL).catch((err) => {
      logger.error("[windowManager] loadURL (dev) failed:", err);
    });
  } else {
    logger.info(`[windowManager] Loading prod file: ${PROD_FILE_PATH}`);
    mainWindow.loadFile(PROD_FILE_PATH).catch((err) => {
      logger.error("[windowManager] loadFile (prod) failed:", err);
    });
  }

  // ── Renderer load failure ─────────────────────────────────────────────────
  // "did-fail-load" fires when the HTML file is not found or network fails.
  // Without this handler the window is silent — user just sees black.
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      logger.error(
        `[windowManager] did-fail-load  code=${errorCode}  desc="${errorDescription}"  url="${validatedURL}"`
      );
      // Send a diagnostic message to the renderer so it can display it.
      // (If the renderer itself failed to load, this is a no-op but harmless.)
      mainWindow?.webContents.send("debug:load-failure", {
        errorCode,
        errorDescription,
        validatedURL,
      });
    }
  );

  // ── Renderer process crash ────────────────────────────────────────────────
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    logger.error(
      `[windowManager] Renderer process gone — reason: ${details.reason}  exitCode: ${details.exitCode}`
    );
  });

  mainWindow.webContents.on("unresponsive", () => {
    logger.warn("[windowManager] Renderer is unresponsive");
  });

  // ── Forward renderer console messages to the log file ────────────────────
  // In production devTools are disabled, so renderer errors are otherwise
  // invisible.  This mirrors them into the electron-log file.
  mainWindow.webContents.on(
    "console-message",
    (_event, level, message, line, sourceId) => {
      const tag = ["verbose", "info", "warn", "error"][level] ?? "info";
      const text = `[renderer/${tag}] ${message}  (${sourceId}:${line})`;
      if (level >= 3) logger.error(text);
      else if (level === 2) logger.warn(text);
      else logger.debug(text);
    }
  );

  // Show window gracefully after React mounts.
  // devTools: open detached in dev; in production we enable them but don't
  // auto-open so the user can press Ctrl+Shift+I for on-demand inspection.
  mainWindow.once("ready-to-show", () => {
    mainWindow!.show();
    logger.info("[windowManager] Window shown (ready-to-show)");
    if (isDev) {
      mainWindow!.webContents.openDevTools({ mode: "detach" });
    }
  });

  // ── Window state persistence ───────────────────────────────────────────────

  const saveWindowState = debounce(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const b = mainWindow.getBounds();
      setSetting("windowBounds", b);
    }
    setSetting("windowMaximized", mainWindow.isMaximized());
  }, 500);

  mainWindow.on("resize",     saveWindowState);
  mainWindow.on("move",       saveWindowState);
  mainWindow.on("maximize",   saveWindowState);
  mainWindow.on("unmaximize", saveWindowState);

  // ── Window state events → renderer ────────────────────────────────────────

  const sendWindowState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const payload: WindowStatePayload = {
      isMaximized:  mainWindow.isMaximized(),
      isFullScreen: mainWindow.isFullScreen(),
    };
    mainWindow.webContents.send(IPC.WINDOW_STATE_CHANGED, payload);
  };

  mainWindow.on("maximize",     sendWindowState);
  mainWindow.on("unmaximize",   sendWindowState);
  mainWindow.on("enter-full-screen", sendWindowState);
  mainWindow.on("leave-full-screen", sendWindowState);

  // ── Close behaviour ────────────────────────────────────────────────────────

  mainWindow.on("close", (e) => {
    const closeToTray = getSetting("closeToTray");
    if (closeToTray && !app.isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
      logger.debug("Window hidden to tray (close-to-tray enabled)");
    } else {
      saveWindowState.flush?.();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // ── External link handling ─────────────────────────────────────────────────
  // Open non-messenger links in the default browser, not in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith("https://www.messenger.com") &&
        !url.startsWith("https://messenger.com") &&
        !url.startsWith("https://www.facebook.com")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  return mainWindow;
}

export function showMainWindow(): void {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  if (mainWindow.isMinimized()) mainWindow.restore();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAppIcon(): Electron.NativeImage {
  const iconPath = isDev
    ? path.join(process.cwd(), "assets", "icon.ico")
    : path.join(process.resourcesPath, "icon.ico");
  try {
    return nativeImage.createFromPath(iconPath);
  } catch {
    return nativeImage.createEmpty();
  }
}

function ensureVisibleOnDisplay(
  bounds: { x?: number; y?: number; width: number; height: number }
): { x?: number; y?: number; width: number; height: number } {
  if (bounds.x === undefined || bounds.y === undefined) return bounds;
  const displays = screen.getAllDisplays();
  const visible = displays.some((d) => {
    const wb = d.workArea;
    return (
      bounds.x! >= wb.x &&
      bounds.y! >= wb.y &&
      bounds.x! < wb.x + wb.width &&
      bounds.y! < wb.y + wb.height
    );
  });
  if (!visible) {
    // ── FIX: The original code did:
    //      const { x, y } = undefined as unknown as { x: undefined; y: undefined };
    //   Destructuring `undefined` throws a TypeError and crashes window creation.
    //   Intent was to reset x/y so Electron centres the window on the primary display.
    logger.warn(
      "[windowManager] Saved window position is off all displays — resetting to centre"
    );
    return { ...bounds, x: undefined, y: undefined };
  }
  return bounds;
}

function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number
): T & { flush?: () => void } {
  let timer: NodeJS.Timeout | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      fn();
    }
  };
  return debounced as T & { flush?: () => void };
}
