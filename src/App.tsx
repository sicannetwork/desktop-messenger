import React, { useEffect } from "react";
import { TitleBar }         from "./components/TitleBar";
import { SplashScreen }     from "./components/SplashScreen";
import { SettingsPanel }    from "./components/Settings";
import { WebviewContainer } from "./components/WebviewContainer";
import { ErrorBoundary }    from "./components/ErrorBoundary";
import { useStore }         from "./store/useStore";
import type { WindowStatePayload } from "../shared/ipc-types";

const MESSENGER_URL = "https://www.messenger.com/";

export default function App() {
  const {
    isLoading,
    showSettings,
    currentTheme,
    setSettings,
    setMaximized,
    setTheme,
    setAppVersion,
    setShowSettings,
  } = useStore();

  // ── Bootstrap: load settings & app version from main ──────────────────────
  useEffect(() => {
    (async () => {
      const [settings, version] = await Promise.all([
        window.electron.settings.get(),
        window.electron.app.getVersion(),
      ]);
      setSettings(settings);
      setAppVersion(version);

      // Apply zoom from persisted setting
      window.electron.webview?.updateUnreadCount?.(0);

      // Derive initial theme from system or user preference
      applyTheme(settings.theme);
    })();
  }, []);

  // ── IPC listeners ──────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubState = window.electron.on(
      "window:stateChanged",
      (state: unknown) => {
        const s = state as WindowStatePayload;
        setMaximized(s.isMaximized);
      }
    );

    const unsubTheme = window.electron.on(
      "theme:changed",
      (theme: unknown) => {
        if (theme === "dark" || theme === "light") setTheme(theme);
      }
    );

    const unsubSettings = window.electron.on(
      "nav:settings",
      () => setShowSettings(true)
    );

    return () => {
      unsubState();
      unsubTheme();
      unsubSettings();
    };
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+, → settings
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        setShowSettings(true);
      }
      // F11 → maximize toggle (handled in TitleBar via IPC)
      // Ctrl+Shift+I → dev tools: allowed only in dev, handled by Electron
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <ErrorBoundary>
      <div
        id="app-root"
        style={{
          display:       "flex",
          flexDirection: "column",
          height:        "100vh",
          width:         "100vw",
          overflow:      "hidden",
          background:    "#0a0a0a",
          colorScheme:   currentTheme,
        }}
      >
        {/* Custom frameless title bar */}
        <TitleBar />

        {/* Webview — the entire Messenger.com UI */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <WebviewContainer url={MESSENGER_URL} />
        </div>

        {/* Overlays */}
        <SplashScreen visible={isLoading} />
        {showSettings && <SettingsPanel />}
      </div>
    </ErrorBoundary>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function applyTheme(pref: "system" | "light" | "dark") {
  const isDark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
}
