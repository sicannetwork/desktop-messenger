// FILE: electron/main/index.ts
/**
 * MessengerDesk — Electron Main Process
 * Entry point: bootstraps all subsystems in the correct order.
 */

import { app, Menu, nativeTheme } from "electron";
import { initLogger, logger } from "./logger";
import { getSetting } from "./store";
import { configureMessengerSession } from "./sessionManager";
import { createMainWindow, getMainWindow } from "./windowManager";
import { createTray, destroyTray } from "./trayManager";
import { registerIpcHandlers } from "./ipcHandlers";
import { IPC } from "../../shared/ipc-types";
import path from "path";
import fs from "fs";

// ─── EARLIEST POSSIBLE: init logger so all subsequent errors are captured ──────
// (initLogger() normally runs inside app.whenReady, but we need it NOW so that
//  crashes during the pre-ready phase land in the log file instead of disappearing.)
try {
  initLogger();
} catch (_) {
  // If the log dir isn't writable yet, fall through — console still works.
}

logger.info("=== MessengerDesk main process starting ===");
logger.info(`Node ${process.versions.node} | Electron ${process.versions.electron}`);
logger.info(`Platform: ${process.platform} ${process.arch}`);
logger.info(`__dirname: ${__dirname}`);
logger.info(`process.resourcesPath: ${(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath}`);

// Log the dist/index.html path so we can confirm it exists in the package
const expectedDistIndex = path.join(__dirname, "../../../dist/index.html");
logger.info(`Expected dist/index.html: ${expectedDistIndex}`);
try {
  const exists = fs.existsSync(expectedDistIndex);
  logger.info(`  → dist/index.html exists on disk: ${exists}`);
} catch (e) {
  logger.error(`  → Could not stat dist/index.html:`, e);
}

// ─── Catch any unhandled errors before app.whenReady() ────────────────────────
process.on("uncaughtException", (err) => {
  logger.error("[main] uncaughtException (pre-ready):", err);
});
process.on("unhandledRejection", (reason) => {
  logger.error("[main] unhandledRejection (pre-ready):", reason);
});

// ─── Single instance lock ─────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  const win = getMainWindow();
  if (win) {
    if (win.isMinimized() || !win.isVisible()) win.restore();
    win.show();
    win.focus();
  }
});

// ─── Hardware acceleration ────────────────────────────────────────────────────
// Must be called before app "ready".
// ── FIX: Wrap in try/catch — electron-store reads userData path here, which
//         can throw on some Windows configurations before app is ready.
try {
  const hwAccel = getSetting("hardwareAcceleration");
  logger.info(`[main] hardwareAcceleration setting: ${hwAccel}`);
  if (!hwAccel) {
    app.disableHardwareAcceleration();
    logger.info("[main] Hardware acceleration disabled per user setting");
  }
} catch (err) {
  logger.error("[main] Failed to read hardwareAcceleration setting — leaving HW accel enabled:", err);
}

// ─── Windows-specific app metadata ────────────────────────────────────────────
if (process.platform === "win32") {
  app.setAppUserModelId("com.messengerdesk.app");
}

// ─── App ready ────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // initLogger() already called at top of file; call again is a no-op but safe.
  logger.info(`=== MessengerDesk ${app.getVersion()} ready ===`);
  logger.info(`userData path: ${app.getPath("userData")}`);

  // Remove default application menu (we use custom title bar).
  Menu.setApplicationMenu(null);

  // Configure the isolated Messenger session BEFORE window creation.
  try {
    configureMessengerSession();
    logger.info("[main] Session configured");
  } catch (err) {
    logger.error("[main] configureMessengerSession failed:", err);
  }

  // Register all IPC channels.
  try {
    registerIpcHandlers();
    logger.info("[main] IPC handlers registered");
  } catch (err) {
    logger.error("[main] registerIpcHandlers failed:", err);
  }

  // Create and show the main window.
  let win: Electron.BrowserWindow;
  try {
    win = createMainWindow();
    logger.info("[main] Main window created");
  } catch (err) {
    logger.error("[main] createMainWindow FAILED — this is why you see a blank screen:", err);
    return;
  }

  // Create system tray after window.
  try {
    createTray(win);
    logger.info("[main] Tray created");
  } catch (err) {
    logger.warn("[main] createTray failed (non-fatal):", err);
  }

  // Sync native dark/light mode → renderer on OS theme change.
  nativeTheme.on("updated", () => {
    win.webContents.send("theme:changed", nativeTheme.shouldUseDarkColors ? "dark" : "light");
  });

  logger.info("App ready — all subsystems online");
});

// ─── macOS re-open (no-op on Windows, but keeps TS happy) ─────────────────────
app.on("activate", () => {
  if (!getMainWindow()) createMainWindow();
});

// ─── Quit handling ────────────────────────────────────────────────────────────
app.on("window-all-closed", () => {
  // On Windows, all-windows-closed means quit unless tray is up.
  // Tray is persistent so we DON'T quit here by default.
  // The tray "Quit" menu item sets app.isQuitting = true before calling app.quit().
  if (process.platform !== "darwin" && app.isQuitting) {
    destroyTray();
    app.quit();
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
});

// Extend app type (declared in trayManager too; idempotent)
declare global {
  namespace Electron {
    interface App {
      isQuitting: boolean;
    }
  }
}
app.isQuitting = false;
