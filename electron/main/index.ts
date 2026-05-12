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
if (!getSetting("hardwareAcceleration")) {
  app.disableHardwareAcceleration();
}

// ─── Windows-specific app metadata ────────────────────────────────────────────
if (process.platform === "win32") {
  app.setAppUserModelId("com.messengerdesk.app");
}

// ─── App ready ────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  initLogger();
  logger.info(`=== MessengerDesk ${app.getVersion()} starting ===`);
  logger.info(`Electron ${process.versions.electron} | Node ${process.versions.node}`);

  // Remove default application menu (we use custom title bar).
  Menu.setApplicationMenu(null);

  // Configure the isolated Messenger session BEFORE window creation.
  configureMessengerSession();

  // Register all IPC channels.
  registerIpcHandlers();

  // Create and show the main window.
  const win = createMainWindow();

  // Create system tray after window.
  createTray(win);

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
