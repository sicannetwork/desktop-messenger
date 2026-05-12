import React, { useEffect, useState } from "react";

interface Props {
  visible: boolean;
}

export const SplashScreen: React.FC<Props> = ({ visible }) => {
  const [opacity, setOpacity] = useState(1);
  const [display, setDisplay] = useState(true);

  useEffect(() => {
    if (!visible) {
      setOpacity(0);
      const t = setTimeout(() => setDisplay(false), 600);
      return () => clearTimeout(t);
    } else {
      setDisplay(true);
      setOpacity(1);
    }
  }, [visible]);

  if (!display) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        opacity,
        transition: "opacity 0.6s ease",
        pointerEvents: visible ? "all" : "none",
      }}
    >
      {/* Animated logo */}
      <div
        style={{
          animation: "splashPulse 2s ease-in-out infinite",
        }}
      >
        <svg width="80" height="80" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="18" fill="url(#splashGrad)" />
          <path
            d="M18 5C10.82 5 5 10.4 5 17c0 3.7 1.72 7 4.45 9.3V31l4.15-2.27A13.4 13.4 0 0018 29c7.18 0 13-5.4 13-12S25.18 5 18 5zm1.3 16.16L16 17.78l-6.26 3.38 6.87-7.27 3.3 3.38 6.24-3.38-6.85 7.27z"
            fill="white"
          />
          <defs>
            <linearGradient id="splashGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0099FF" />
              <stop offset="1" stopColor="#A033FF" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#e4e6eb",
          letterSpacing: "-0.02em",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        Messenger
      </span>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0099ff, #a033ff)",
              animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes splashPulse {
          0%, 100% { transform: scale(1);   filter: drop-shadow(0 0 16px rgba(0,153,255,0.4)); }
          50%       { transform: scale(1.05); filter: drop-shadow(0 0 32px rgba(160,51,255,0.6)); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0);   opacity: 0.4; }
          40%           { transform: translateY(-6px); opacity: 1;   }
        }
      `}</style>
    </div>
  );
};
