import React, { useEffect, useState } from "react";
import { useStore } from "../store/useStore";

declare global {
  interface Window {
    electron: import("../../electron/preload/index").ElectronBridge;
  }
}

/** Custom frameless title bar that matches the Messenger visual identity. */
export const TitleBar: React.FC = () => {
  const { isMaximized, setMaximized, unreadCount } = useStore();
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    const unsub = window.electron.window.onStateChanged((state) => {
      setMaximized(state.isMaximized);
    });

    const onFocus = () => setIsFocused(true);
    const onBlur  = () => setIsFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur",  onBlur);

    // Hydrate initial state
    window.electron.window.isMaximized().then(setMaximized);

    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur",  onBlur);
    };
  }, []);

  const title = unreadCount > 0 ? `Messenger (${unreadCount})` : "Messenger";

  return (
    <div
      className="titlebar"
      style={{
        WebkitAppRegion: "drag",
        height: "36px",
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px 0 14px",
        flexShrink: 0,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        userSelect: "none",
      } as React.CSSProperties}
    >
      {/* App identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <MessengerLogo size={18} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isFocused ? "#e4e6eb" : "#6e6e6e",
            letterSpacing: "0.01em",
            transition: "color 0.15s",
          }}
        >
          {title}
        </span>
      </div>

      {/* Window controls — must NOT be draggable */}
      <div
        style={{ WebkitAppRegion: "no-drag", display: "flex", gap: 2 } as React.CSSProperties}
      >
        <TitleBarButton
          title="Minimise"
          onClick={() => window.electron.window.minimize()}
          icon={<MinimizeIcon />}
          hoverColor="#2a2a2a"
        />
        <TitleBarButton
          title={isMaximized ? "Restore" : "Maximise"}
          onClick={() => window.electron.window.maximize()}
          icon={isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
          hoverColor="#2a2a2a"
        />
        <TitleBarButton
          title="Close"
          onClick={() => window.electron.window.close()}
          icon={<CloseIcon />}
          hoverColor="#c42b1c"
        />
      </div>
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────────

interface BtnProps {
  title:      string;
  onClick:    () => void;
  icon:       React.ReactNode;
  hoverColor: string;
}

const TitleBarButton: React.FC<BtnProps> = ({ title, onClick, icon, hoverColor }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 46,
        height: 36,
        border: "none",
        background: hovered ? hoverColor : "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        transition: "background 0.1s",
        outline: "none",
        color: hovered && hoverColor === "#c42b1c" ? "#fff" : "#a8a8a8",
      }}
    >
      {icon}
    </button>
  );
};

const MessengerLogo: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <circle cx="18" cy="18" r="18" fill="url(#msgGrad)" />
    <path
      d="M18 5C10.82 5 5 10.4 5 17c0 3.7 1.72 7 4.45 9.3V31l4.15-2.27A13.4 13.4 0 0018 29c7.18 0 13-5.4 13-12S25.18 5 18 5zm1.3 16.16L16 17.78l-6.26 3.38 6.87-7.27 3.3 3.38 6.24-3.38-6.85 7.27z"
      fill="white"
    />
    <defs>
      <linearGradient id="msgGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0099FF" />
        <stop offset="1" stopColor="#A033FF" />
      </linearGradient>
    </defs>
  </svg>
);

const MinimizeIcon = () => (
  <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
    <rect width="10" height="1" />
  </svg>
);
const MaximizeIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="0.5" y="0.5" width="9" height="9" />
  </svg>
);
const RestoreIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="2.5" y="0.5" width="7" height="7" />
    <path d="M0.5 2.5v7h7" />
  </svg>
);
const CloseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
    <line x1="0" y1="0" x2="10" y2="10" />
    <line x1="10" y1="0" x2="0" y2="10" />
  </svg>
);
