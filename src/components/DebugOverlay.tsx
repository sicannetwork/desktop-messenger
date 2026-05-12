// FILE: src/components/DebugOverlay.tsx
/**
 * DebugOverlay
 *
 * Catches and displays the most common causes of a blank Electron window:
 *  • window.electron bridge missing (preload failed)
 *  • IPC bootstrap failure (settings / version call threw)
 *  • did-fail-load signal from the main process
 *  • Webview load errors forwarded from WebviewContainer
 *
 * The overlay is rendered BELOW the SplashScreen (lower z-index) so it only
 * becomes visible once isLoading becomes false — or immediately if React itself
 * fails to call setLoading(false) within the timeout.
 *
 * Remove or gate this behind a flag once the app is stable.
 */

import React, { useEffect, useRef, useState } from "react";

export interface DebugMessage {
  level: "info" | "warn" | "error";
  text: string;
  ts: number;
}

interface Props {
  /** Extra messages pushed from WebviewContainer or App */
  extraMessages?: DebugMessage[];
}

const PANEL_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  maxHeight: 260,
  overflowY: "auto",
  background: "rgba(10,10,10,0.92)",
  borderTop: "1px solid rgba(255,100,100,0.35)",
  zIndex: 99998,
  fontFamily: "'Cascadia Code','Consolas','Courier New',monospace",
  fontSize: 11,
  padding: "8px 12px",
  boxSizing: "border-box",
};

const ROW_COLORS: Record<DebugMessage["level"], string> = {
  info:  "#8be8cb",
  warn:  "#f1c40f",
  error: "#ff6b6b",
};

function fmt(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}.${String(d.getMilliseconds()).padStart(3,"0")}`;
}

export const DebugOverlay: React.FC<Props> = ({ extraMessages = [] }) => {
  const [messages, setMessages] = useState<DebugMessage[]>([]);
  const [visible, setVisible]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Collect startup diagnostics
  useEffect(() => {
    const init: DebugMessage[] = [];

    const push = (level: DebugMessage["level"], text: string) => {
      init.push({ level, text, ts: Date.now() });
    };

    // 1. Check bridge
    if (typeof (window as unknown as { electron?: unknown }).electron === "undefined") {
      push("error", "window.electron is UNDEFINED — preload script did not run or contextBridge failed.");
      push("warn",  "Possible causes: preload path wrong in windowManager, sandbox=true overriding webPreferences, or asar packaging issue.");
    } else {
      push("info", "window.electron bridge present ✓");
    }

    // 2. Check webview tag support
    const testWv = document.createElement("webview");
    if (testWv.tagName.toLowerCase() !== "webview") {
      push("error", "<webview> tag not supported — webviewTag:true may not be set or Electron version too old.");
    } else {
      push("info", "<webview> tag supported ✓");
    }

    // 3. Environment info
    push("info", `NODE_ENV=${process.env.NODE_ENV ?? "(not set)"}`);
    push("info", `User-Agent: ${navigator.userAgent}`);

    if (init.some(m => m.level === "error")) setVisible(true);
    setMessages(init);
  }, []);

  // Listen for did-fail-load signal from main process
  useEffect(() => {
    const el = (window as unknown as { electron?: { on: (ch: string, cb: (...a: unknown[]) => void) => () => void } }).electron;
    if (!el) return;

    const unsub = el.on("debug:load-failure", (...args: unknown[]) => {
      const payload = args[0] as { errorCode: number; errorDescription: string; validatedURL: string };
      setMessages(prev => [
        ...prev,
        {
          level: "error",
          text: `did-fail-load: code=${payload.errorCode}  "${payload.errorDescription}"  url="${payload.validatedURL}"`,
          ts: Date.now(),
        },
      ]);
      setVisible(true);
    });
    return unsub;
  }, []);

  // Merge external messages (from WebviewContainer, App, etc.)
  useEffect(() => {
    if (!extraMessages.length) return;
    setMessages(prev => [...prev, ...extraMessages]);
    if (extraMessages.some(m => m.level === "error")) setVisible(true);
  }, [extraMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!visible) return null;

  return (
    <div style={PANEL_STYLE}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ color:"#ff6b6b", fontWeight:700, fontSize:12 }}>
          ⚠ Debug Console — press Ctrl+Shift+I for full DevTools
        </span>
        <button
          onClick={() => setVisible(false)}
          style={{ background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:12 }}
        >
          ✕
        </button>
      </div>
      {messages.map((m, i) => (
        <div key={i} style={{ color: ROW_COLORS[m.level], lineHeight: 1.6, whiteSpace:"pre-wrap", wordBreak:"break-all" }}>
          <span style={{ color:"#555", marginRight:8 }}>{fmt(m.ts)}</span>
          <span style={{ color:"#888", marginRight:8 }}>[{m.level.toUpperCase()}]</span>
          {m.text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
