/**
 * MessengerDesk — Typed IPC Contracts
 * All channels between main and renderer are declared here.
 * Never use raw strings for IPC — always reference these constants.
 */

// ─── Channel Names ────────────────────────────────────────────────────────────

/**
 * The dedicated session partition for messenger.com.
 * Declared here (shared) so both the renderer and electron main can import it
 * without the renderer pulling in Node-only electron imports.
 */
export const MESSENGER_PARTITION = "persist:messenger";

export const IPC = {
  // Window control
  WINDOW_MINIMIZE: "window:minimize",
  WINDOW_MAXIMIZE: "window:maximize",
  WINDOW_RESTORE:  "window:restore",
  WINDOW_CLOSE:    "window:close",
  WINDOW_IS_MAXIMIZED: "window:isMaximized",
  WINDOW_STATE_CHANGED: "window:stateChanged",

  // Tray
  TRAY_UPDATE_BADGE: "tray:updateBadge",

  // Notifications
  NOTIFY_SHOW:    "notify:show",
  NOTIFY_CLICKED: "notify:clicked",

  // Settings
  SETTINGS_GET:   "settings:get",
  SETTINGS_SET:   "settings:set",
  SETTINGS_RESET: "settings:reset",

  // Session / Auth
  SESSION_CLEAR:  "session:clear",
  SESSION_STATUS: "session:status",

  // App
  APP_GET_VERSION: "app:getVersion",
  APP_OPEN_EXTERNAL: "app:openExternal",
  APP_RELAUNCH:    "app:relaunch",
  APP_QUIT:        "app:quit",

  // Webview bridging
  WEBVIEW_UNREAD_COUNT: "webview:unreadCount",
  WEBVIEW_NAVIGATED:    "webview:navigated",
  WEBVIEW_TITLE:        "webview:title",
  WEBVIEW_ZOOM:         "webview:zoom",

  // Updates
  UPDATE_CHECK:     "update:check",
  UPDATE_AVAILABLE: "update:available",
  UPDATE_PROGRESS:  "update:progress",
  UPDATE_READY:     "update:ready",
  UPDATE_INSTALL:   "update:install",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

// ─── Payload Types ────────────────────────────────────────────────────────────

export interface NotifyPayload {
  title: string;
  body:  string;
  icon?: string;
  /** URL path on messenger.com to navigate to when clicked */
  url?: string;
}

export interface SettingsSchema {
  launchOnStartup:         boolean;
  minimizeToTray:          boolean;
  closeToTray:             boolean;
  showNotifications:       boolean;
  notificationSound:       boolean;
  theme:                   "system" | "light" | "dark";
  zoomLevel:               number;   // 0.5 – 2.0
  hardwareAcceleration:    boolean;
  spellcheck:              boolean;
  windowBounds: {
    x?:       number;
    y?:       number;
    width:    number;
    height:   number;
  };
  windowMaximized: boolean;
}

export const DEFAULT_SETTINGS: SettingsSchema = {
  launchOnStartup:      false,
  minimizeToTray:       true,
  closeToTray:          true,
  showNotifications:    true,
  notificationSound:    true,
  theme:                "system",
  zoomLevel:            1.0,
  hardwareAcceleration: true,
  spellcheck:           true,
  windowBounds: {
    width:  1200,
    height: 800,
  },
  windowMaximized: false,
};

export interface WindowStatePayload {
  isMaximized: boolean;
  isFullScreen: boolean;
}

export interface UpdateProgressPayload {
  percent:           number;
  bytesPerSecond:    number;
  transferred:       number;
  total:             number;
}

export interface AppVersionInfo {
  version:    string;
  electronVersion: string;
  nodeVersion: string;
  platform:   string;
  arch:       string;
}
