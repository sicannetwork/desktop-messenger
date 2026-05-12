// FILE: electron/preload/index.ts
/**
 * MessengerDesk — Preload Script
 *
 * Runs in a sandboxed Node context. Exposes ONLY the minimal, typed API
 * surface to the renderer via contextBridge. No raw IPC, no Node globals.
 */

import { contextBridge, ipcRenderer } from "electron";
import { IPC, NotifyPayload, SettingsSchema, AppVersionInfo } from "../../shared/ipc-types";

// ─── Validated channel sets ───────────────────────────────────────────────────
// Only channels listed here can ever be used by renderer code.

const SEND_CHANNELS = new Set<string>([
  IPC.WINDOW_MINIMIZE,
  IPC.WINDOW_MAXIMIZE,
  IPC.WINDOW_RESTORE,
  IPC.WINDOW_CLOSE,
  IPC.TRAY_UPDATE_BADGE,
  IPC.NOTIFY_SHOW,
  IPC.WEBVIEW_UNREAD_COUNT,
  IPC.WEBVIEW_TITLE,
  IPC.WEBVIEW_NAVIGATED,
  IPC.APP_QUIT,
  IPC.APP_RELAUNCH,
]);

const INVOKE_CHANNELS = new Set<string>([
  IPC.WINDOW_IS_MAXIMIZED,
  IPC.SETTINGS_GET,
  IPC.SETTINGS_SET,
  IPC.SETTINGS_RESET,
  IPC.SESSION_CLEAR,
  IPC.APP_GET_VERSION,
  IPC.APP_OPEN_EXTERNAL,
]);

const RECEIVE_CHANNELS = new Set<string>([
  IPC.WINDOW_STATE_CHANGED,
  IPC.NOTIFY_CLICKED,
  IPC.UPDATE_AVAILABLE,
  IPC.UPDATE_PROGRESS,
  IPC.UPDATE_READY,
  "theme:changed",
  "nav:url",
  "nav:settings",
  "nav:newMessage",
  "update:check",
  // ── Debug channels (used to surface main-process errors into the UI) ──────
  "debug:load-failure",
]);

// ─── Exposed API ──────────────────────────────────────────────────────────────

export type ElectronBridge = typeof electronBridge;

const electronBridge = {
  // Window controls
  window: {
    minimize:    ()        => safeSend(IPC.WINDOW_MINIMIZE),
    maximize:    ()        => safeSend(IPC.WINDOW_MAXIMIZE),
    restore:     ()        => safeSend(IPC.WINDOW_RESTORE),
    close:       ()        => safeSend(IPC.WINDOW_CLOSE),
    isMaximized: ()        => safeInvoke<boolean>(IPC.WINDOW_IS_MAXIMIZED),
    onStateChanged: (cb: (state: { isMaximized: boolean; isFullScreen: boolean }) => void) =>
      listen(IPC.WINDOW_STATE_CHANGED, (...args) =>
        cb(args[0] as { isMaximized: boolean; isFullScreen: boolean })
      ),
  },

  // Tray
  tray: {
    updateBadge: (count: number) => safeSend(IPC.TRAY_UPDATE_BADGE, count),
  },

  // Notifications
  notifications: {
    show: (payload: NotifyPayload) => safeSend(IPC.NOTIFY_SHOW, payload),
  },

  // Settings
  settings: {
    get:   ()                                         => safeInvoke<SettingsSchema>(IPC.SETTINGS_GET),
    set:   <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) =>
                                                         safeInvoke(IPC.SETTINGS_SET, key, value),
    reset: ()                                         => safeInvoke(IPC.SETTINGS_RESET),
  },

  // Session
  session: {
    clear: () => safeInvoke(IPC.SESSION_CLEAR),
  },

  // App
  app: {
    getVersion:   ()          => safeInvoke<AppVersionInfo>(IPC.APP_GET_VERSION),
    openExternal: (url: string) => safeInvoke(IPC.APP_OPEN_EXTERNAL, url),
    relaunch:     ()          => safeSend(IPC.APP_RELAUNCH),
    quit:         ()          => safeSend(IPC.APP_QUIT),
  },

  // Webview bridge
  webview: {
    updateUnreadCount: (count: number) => safeSend(IPC.WEBVIEW_UNREAD_COUNT, count),
    updateTitle:       (title: string) => safeSend(IPC.WEBVIEW_TITLE, title),
  },

  // Event listeners (renderer receiving from main)
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    if (!RECEIVE_CHANNELS.has(channel)) {
      console.warn(`[preload] Blocked unlisted receive channel: ${channel}`);
      return () => {};
    }
    const sub = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, sub);
    return () => ipcRenderer.removeListener(channel, sub);
  },
};

contextBridge.exposeInMainWorld("electron", electronBridge);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeSend(channel: string, ...args: unknown[]): void {
  if (!SEND_CHANNELS.has(channel)) {
    console.warn(`[preload] Blocked unlisted send channel: ${channel}`);
    return;
  }
  ipcRenderer.send(channel, ...args);
}

function safeInvoke<T = void>(channel: string, ...args: unknown[]): Promise<T> {
  if (!INVOKE_CHANNELS.has(channel)) {
    console.warn(`[preload] Blocked unlisted invoke channel: ${channel}`);
    return Promise.reject(new Error(`Channel not allowed: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

function listen(channel: string, cb: (...args: unknown[]) => void): () => void {
  if (!RECEIVE_CHANNELS.has(channel)) return () => {};
  const handler = (_: Electron.IpcRendererEvent, ...a: unknown[]) => cb(...a);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}
