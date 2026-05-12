// FILE: src/components/WebviewContainer.tsx
import React, { useEffect, useRef, useCallback, useState } from "react";
import { useStore } from "../store/useStore";
import { MESSENGER_PARTITION } from "../../shared/ipc-types";
import type { DebugMessage } from "./DebugOverlay";

// ── Messenger-specific content script injected into the webview ────────────────
// This script runs inside the messenger.com page context to:
// 1. Extract unread message count from the title or DOM
// 2. Intercept notifications and forward them to Electron
// 3. Apply theme overrides if needed

const INJECTED_SCRIPT = `
(function messengerDesk() {
  'use strict';

  // ── Unread count extraction ──────────────────────────────────────────────
  function extractUnreadCount() {
    const title = document.title;
    const match = title.match(/\\((\\d+)\\)/);
    const count = match ? parseInt(match[1], 10) : 0;
    window.messengerDeskBridge?.updateUnreadCount(count);
  }

  // Watch for title changes
  const titleObserver = new MutationObserver(() => extractUnreadCount());
  titleObserver.observe(document.querySelector('title') || document.head, {
    subtree: true, childList: true, characterData: true
  });
  extractUnreadCount();

  // ── Notification interception ────────────────────────────────────────────
  const OriginalNotification = window.Notification;
  window.Notification = function(title, opts) {
    window.messengerDeskBridge?.showNotification({ title, body: opts?.body ?? '' });
    // Still create the real notification so we honour the permission model
    return new OriginalNotification(title, opts);
  };
  Object.assign(window.Notification, OriginalNotification);

  // ── Initial title send ───────────────────────────────────────────────────
  window.messengerDeskBridge?.updateTitle(document.title);

  console.log('[MessengerDesk] Content bridge active');
})();
`;

interface Props {
  url: string;
  /** Optional callback so the parent can collect debug messages from the webview */
  onDebugMessage?: (msg: DebugMessage) => void;
}

export const WebviewContainer: React.FC<Props> = ({ url, onDebugMessage }) => {
  const ref      = useRef<Electron.WebviewTag>(null);
  const { setUnreadCount, setLoading, settings } = useStore();
  const [webviewError, setWebviewError] = useState<string | null>(null);

  const dbg = useCallback((level: DebugMessage["level"], text: string) => {
    console[level](`[WebviewContainer] ${text}`);
    onDebugMessage?.({ level, text, ts: Date.now() });
  }, [onDebugMessage]);

  // ── Attach webview event listeners once ───────────────────────────────────

  const attachListeners = useCallback(() => {
    const wv = ref.current;
    if (!wv) {
      dbg("error", "attachListeners called but ref.current is null — webview did not mount");
      return;
    }

    dbg("info", `Attaching webview listeners. WebContentsId=${wv.getWebContentsId()}`);

    wv.addEventListener("did-start-loading", () => {
      dbg("info", "webview did-start-loading");
      setLoading(true);
    });
    wv.addEventListener("did-stop-loading",  () => {
      dbg("info", "webview did-stop-loading");
      setLoading(false);
    });

    // ── NEW: handle webview load failure ──────────────────────────────────────
    wv.addEventListener("did-fail-load", (event) => {
      const ev = event as unknown as {
        errorCode: number;
        errorDescription: string;
        validatedURL: string;
        isMainFrame: boolean;
      };
      // Ignore sub-frame failures and the benign "aborted" code (-3)
      if (!ev.isMainFrame || ev.errorCode === -3) return;
      const msg = `Webview did-fail-load: code=${ev.errorCode} "${ev.errorDescription}" url="${ev.validatedURL}"`;
      dbg("error", msg);
      setWebviewError(msg);
      setLoading(false); // don't leave splash screen up
    });

    // ── NEW: handle renderer crash inside the webview ─────────────────────────
    wv.addEventListener("crashed", () => {
      dbg("error", "Webview renderer process CRASHED");
      setWebviewError("The Messenger webview renderer crashed. Click the reload button to retry.");
      setLoading(false);
    });

    wv.addEventListener("did-finish-load", () => {
      dbg("info", "webview did-finish-load — injecting bridge script");
      // Set zoom
      wv.setZoomFactor(settings.zoomLevel);
      // Inject content bridge
      wv.executeJavaScript(INJECTED_SCRIPT).catch((e) => {
        dbg("warn", `executeJavaScript failed: ${e}`);
      });
    });

    wv.addEventListener("did-navigate", (_e) => {
      window.electron.webview.updateTitle(document.title);
    });

    wv.addEventListener("page-title-updated", (e) => {
      const ev = e as unknown as { title: string };
      window.electron.webview.updateTitle(ev.title);
      // Extract unread from title pattern "Messenger (3)"
      const match = ev.title.match(/\((\d+)\)/);
      const count = match ? parseInt(match[1], 10) : 0;
      setUnreadCount(count);
      window.electron.webview.updateUnreadCount(count);
    });

    wv.addEventListener("ipc-message", (event) => {
      const ev = event as unknown as { channel: string; args: unknown[] };
      if (ev.channel === "unread-count" && typeof ev.args[0] === "number") {
        setUnreadCount(ev.args[0]);
        window.electron.webview.updateUnreadCount(ev.args[0]);
      }
    });

    // Open external links in default browser
    wv.addEventListener("new-window", (event) => {
      const ev = event as unknown as { url: string };
      if (ev.url && !ev.url.includes("messenger.com") && !ev.url.includes("facebook.com")) {
        window.electron.app.openExternal(ev.url);
      }
    });

    // Forward permission requests
    wv.addEventListener("permission-request", (event) => {
      const ev = event as unknown as { permission: string; request: { allow: () => void; deny: () => void } };
      if (["notifications", "media"].includes(ev.permission)) {
        ev.request.allow();
      } else {
        ev.request.deny();
      }
    });
  }, [settings.zoomLevel, setLoading, setUnreadCount]);

  useEffect(() => {
    const wv = ref.current;
    if (!wv) {
      dbg("error", "useEffect: ref.current is null — <webview> element not in DOM");
      return;
    }

    dbg("info", `useEffect: webview in DOM. getWebContentsId()=${wv.getWebContentsId()}`);

    // WebviewTag is not a standard DOM element — need to wait for "ready"
    if (wv.getWebContentsId() !== -1) {
      attachListeners();
    } else {
      const domReadyOnce = () => {
        wv.removeEventListener("dom-ready", domReadyOnce);
        dbg("info", "webview dom-ready fired — attaching listeners");
        attachListeners();
      };
      wv.addEventListener("dom-ready", domReadyOnce);
    }

    // ── Safety net: if isLoading stays true after 20 s, force it off ─────────
    // Without this, a webview that never fires did-stop-loading (e.g. because
    // it silently failed before dom-ready) leaves the splash screen up forever,
    // which looks like a "blank screen" to the user.
    const loadTimeout = setTimeout(() => {
      dbg("warn", "Loading timeout reached (20 s) — forcing isLoading=false");
      setLoading(false);
    }, 20_000);

    return () => clearTimeout(loadTimeout);
  }, [attachListeners, dbg, setLoading]);

  // Update zoom when setting changes
  useEffect(() => {
    ref.current?.setZoomFactor(settings.zoomLevel);
  }, [settings.zoomLevel]);

  // Navigate to a URL from IPC (e.g., clicking a notification)
  useEffect(() => {
    const unsub = window.electron.on("nav:url", (url: unknown) => {
      if (typeof url === "string" && ref.current) {
        ref.current.loadURL(url);
      }
    });
    return () => unsub();
  }, []);

  return (
    <div style={{ flex: 1, width: "100%", height: "100%", position: "relative" }}>
      {webviewError && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: "#0a0a0a", color: "#ff6b6b",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 12, padding: 24, textAlign: "center",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={{ fontSize: 13, margin: 0, maxWidth: 420, color: "#ccc" }}>{webviewError}</p>
          <button
            onClick={() => { setWebviewError(null); ref.current?.reload(); }}
            style={{
              padding: "7px 18px", background: "linear-gradient(135deg,#0099ff,#a033ff)",
              border: "none", borderRadius: 7, color: "#fff", cursor: "pointer", fontSize: 12,
            }}
          >
            Reload
          </button>
        </div>
      )}
      <webview
        ref={ref as unknown as React.RefObject<HTMLWebViewElement>}
        src={url}
        partition={MESSENGER_PARTITION}
        style={{
          flex:    1,
          width:   "100%",
          height:  "100%",
          display: "flex",
          border:  "none",
          outline: "none",
        }}
        allowpopups
        webpreferences="contextIsolation=yes, nodeIntegration=no, spellcheck=yes"
      />
    </div>
  );
};


