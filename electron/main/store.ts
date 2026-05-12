import Store from "electron-store";
import { SettingsSchema, DEFAULT_SETTINGS } from "../../shared/ipc-types";
import { app } from "electron";

/**
 * Typed electron-store wrapper.
 * Stored at: %APPDATA%\messengerdesk\config.json
 */
const store = new Store<SettingsSchema>({
  name: "config",
  defaults: DEFAULT_SETTINGS,
  schema: {
    launchOnStartup:      { type: "boolean" },
    minimizeToTray:       { type: "boolean" },
    closeToTray:          { type: "boolean" },
    showNotifications:    { type: "boolean" },
    notificationSound:    { type: "boolean" },
    theme:                { type: "string", enum: ["system", "light", "dark"] },
    zoomLevel:            { type: "number", minimum: 0.5, maximum: 2.0 },
    hardwareAcceleration: { type: "boolean" },
    spellcheck:           { type: "boolean" },
    windowBounds: {
      type: "object",
      properties: {
        x:      { type: "number" },
        y:      { type: "number" },
        width:  { type: "number" },
        height: { type: "number" },
      },
      required: ["width", "height"],
    },
    windowMaximized: { type: "boolean" },
  },
});

export function getSettings(): SettingsSchema {
  return store.store;
}

export function getSetting<K extends keyof SettingsSchema>(key: K): SettingsSchema[K] {
  return store.get(key);
}

export function setSetting<K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]): void {
  store.set(key, value);
}

export function resetSettings(): void {
  store.reset(...(Object.keys(DEFAULT_SETTINGS) as (keyof SettingsSchema)[]));
}

export function applyStartupSetting(enable: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enable,
    name: "MessengerDesk",
    path: process.execPath,
  });
}

export default store;
