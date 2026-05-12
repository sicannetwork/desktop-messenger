import { create } from "zustand";
import { SettingsSchema, DEFAULT_SETTINGS, AppVersionInfo } from "../../shared/ipc-types";

interface AppState {
  // UI state
  isLoading:          boolean;
  showSettings:       boolean;
  isMaximized:        boolean;
  unreadCount:        number;
  currentTheme:       "light" | "dark";
  webviewUrl:         string;

  // Settings (loaded from main)
  settings:           SettingsSchema;
  settingsLoaded:     boolean;

  // App info
  appVersion:         AppVersionInfo | null;

  // Actions
  setLoading:         (v: boolean)         => void;
  setShowSettings:    (v: boolean)         => void;
  setMaximized:       (v: boolean)         => void;
  setUnreadCount:     (n: number)          => void;
  setTheme:           (t: "light"|"dark")  => void;
  setWebviewUrl:      (u: string)          => void;
  setSettings:        (s: SettingsSchema)  => void;
  patchSetting: <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) => void;
  setAppVersion:      (v: AppVersionInfo)  => void;
}

export const useStore = create<AppState>((set) => ({
  isLoading:      true,
  showSettings:   false,
  isMaximized:    false,
  unreadCount:    0,
  currentTheme:   "dark",
  webviewUrl:     "https://www.messenger.com/",
  settings:       DEFAULT_SETTINGS,
  settingsLoaded: false,
  appVersion:     null,

  setLoading:      (v) => set({ isLoading: v }),
  setShowSettings: (v) => set({ showSettings: v }),
  setMaximized:    (v) => set({ isMaximized: v }),
  setUnreadCount:  (n) => set({ unreadCount: n }),
  setTheme:        (t) => set({ currentTheme: t }),
  setWebviewUrl:   (u) => set({ webviewUrl: u }),
  setSettings:     (s) => set({ settings: s, settingsLoaded: true }),
  patchSetting: (key, value) =>
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    })),
  setAppVersion:   (v) => set({ appVersion: v }),
}));
