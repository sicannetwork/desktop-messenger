import { ipcMain, app, shell } from "electron";
import {
  IPC,
  NotifyPayload,
  SettingsSchema,
  AppVersionInfo,
} from "../../shared/ipc-types";
import {
  getMainWindow,
  showMainWindow,
} from "./windowManager";
import { showNotification } from "./notificationManager";
import {
  getSettings,
  getSetting,
  setSetting,
  resetSettings,
  applyStartupSetting,
} from "./store";
import { clearMessengerSession } from "./sessionManager";
import { updateTrayBadge } from "./trayManager";
import { logger } from "./logger";

/** Register all validated IPC channels. Called once from main. */
export function registerIpcHandlers(): void {

  // ── Window control ─────────────────────────────────────────────────────────

  ipcMain.on(IPC.WINDOW_MINIMIZE, () => {
    const win = getMainWindow();
    if (!win) return;
    if (getSetting("minimizeToTray")) {
      win.hide();
    } else {
      win.minimize();
    }
  });

  ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });

  ipcMain.on(IPC.WINDOW_RESTORE, () => getMainWindow()?.restore());

  ipcMain.on(IPC.WINDOW_CLOSE, () => {
    const win = getMainWindow();
    if (!win) return;
    const closeToTray = getSetting("closeToTray");
    if (closeToTray) win.hide();
    else win.close();
  });

  ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, () => {
    return getMainWindow()?.isMaximized() ?? false;
  });

  // ── Tray badge ─────────────────────────────────────────────────────────────

  ipcMain.on(IPC.TRAY_UPDATE_BADGE, (_e, count: unknown) => {
    if (typeof count !== "number" || !Number.isFinite(count)) return;
    updateTrayBadge(Math.max(0, Math.floor(count)));
  });

  // ── Notifications ──────────────────────────────────────────────────────────

  ipcMain.on(IPC.NOTIFY_SHOW, (_e, payload: unknown) => {
    if (!isNotifyPayload(payload)) return;
    showNotification(payload);
  });

  // ── Settings ───────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.SETTINGS_GET, () => getSettings());

  ipcMain.handle(
    IPC.SETTINGS_SET,
    (_e, key: unknown, value: unknown) => {
      if (typeof key !== "string") return;
      const safeKey = key as keyof SettingsSchema;
      try {
        setSetting(safeKey, value as SettingsSchema[typeof safeKey]);
        // Side-effects for specific settings
        if (safeKey === "launchOnStartup") {
          applyStartupSetting(Boolean(value));
        }
        if (safeKey === "hardwareAcceleration") {
          logger.info(`Hardware acceleration will change after restart`);
        }
        if (safeKey === "zoomLevel" && typeof value === "number") {
          getMainWindow()?.webContents.setZoomFactor(value);
        }
      } catch (err) {
        logger.error("settings:set error:", err);
      }
    }
  );

  ipcMain.handle(IPC.SETTINGS_RESET, () => {
    resetSettings();
  });

  // ── Session / Auth ─────────────────────────────────────────────────────────

  ipcMain.handle(IPC.SESSION_CLEAR, async () => {
    await clearMessengerSession();
  });

  // ── App ────────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.APP_GET_VERSION, (): AppVersionInfo => ({
    version:         app.getVersion(),
    electronVersion: process.versions.electron,
    nodeVersion:     process.versions.node,
    platform:        process.platform,
    arch:            process.arch,
  }));

  ipcMain.handle(IPC.APP_OPEN_EXTERNAL, async (_e, url: unknown) => {
    if (typeof url !== "string") return;
    // Only allow https URLs to external browser.
    if (!url.startsWith("https://")) return;
    await shell.openExternal(url);
  });

  ipcMain.on(IPC.APP_RELAUNCH, () => {
    app.relaunch();
    app.quit();
  });

  ipcMain.on(IPC.APP_QUIT, () => {
    app.isQuitting = true;
    app.quit();
  });

  // ── Webview bridge ─────────────────────────────────────────────────────────
  // The renderer's <webview> sends unread count updates from the injected
  // content script. We forward to tray badge + taskbar overlay.

  ipcMain.on(IPC.WEBVIEW_UNREAD_COUNT, (_e, count: unknown) => {
    if (typeof count !== "number") return;
    updateTrayBadge(count);
  });

  ipcMain.on(IPC.WEBVIEW_TITLE, (_e, title: unknown) => {
    if (typeof title === "string") {
      getMainWindow()?.setTitle(title);
    }
  });

  logger.info("IPC handlers registered");
}

// ── Guards ────────────────────────────────────────────────────────────────────

function isNotifyPayload(p: unknown): p is NotifyPayload {
  return (
    typeof p === "object" &&
    p !== null &&
    typeof (p as NotifyPayload).title === "string" &&
    typeof (p as NotifyPayload).body  === "string"
  );
}
