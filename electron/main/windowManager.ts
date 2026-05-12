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

const PRELOAD_PATH = path.join(__dirname, "../preload/index.js");
const DEV_URL      = "http://localhost:5173";
const PROD_URL     = `file://${path.join(__dirname, "../../../dist/index.html")}`;
const isDev        = process.env.NODE_ENV === "development";

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
      // Allow devtools only in development
      devTools:             isDev,
    },
    titleBarStyle:   "hidden",
    // Windows-specific title bar overlay (Win11 Mica-style buttons)
    titleBarOverlay: false,
  });

  if (wasMaximized) {
    mainWindow.maximize();
  }

  const url = isDev ? DEV_URL : PROD_URL;
  logger.info(`Loading app from: ${url}`);
  mainWindow.loadURL(url);

  // Show window gracefully after React mounts
  mainWindow.once("ready-to-show", () => {
    mainWindow!.show();
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
    const { x, y } = undefined as unknown as { x: undefined; y: undefined };
    return { ...bounds, x, y };
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
