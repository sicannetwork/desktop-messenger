import React, { useEffect, useRef, useCallback } from "react";
import { useStore } from "../store/useStore";
import { MESSENGER_PARTITION } from "../../electron/main/sessionManager";

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
}

export const WebviewContainer: React.FC<Props> = ({ url }) => {
  const ref      = useRef<Electron.WebviewTag>(null);
  const { setUnreadCount, setLoading, settings } = useStore();

  // ── Attach webview event listeners once ───────────────────────────────────

  const attachListeners = useCallback(() => {
    const wv = ref.current;
    if (!wv) return;

    wv.addEventListener("did-start-loading", () => setLoading(true));
    wv.addEventListener("did-stop-loading",  () => setLoading(false));

    wv.addEventListener("did-finish-load", () => {
      // Set zoom
      wv.setZoomFactor(settings.zoomLevel);
      // Inject content bridge
      wv.executeJavaScript(INJECTED_SCRIPT).catch(console.error);
    });

    wv.addEventListener("did-navigate", (e) => {
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
    if (!wv) return;

    // WebviewTag is not a standard DOM element — need to wait for "ready"
    if (wv.getWebContentsId) {
      attachListeners();
    } else {
      wv.addEventListener("dom-ready", attachListeners, { once: true });
    }
  }, [attachListeners]);

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
    <webview
      ref={ref as React.RefObject<HTMLElement> & React.RefObject<Electron.WebviewTag>}
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
      allowpopups="true"
      webpreferences="contextIsolation=yes, nodeIntegration=no, spellcheck=yes"
    />
  );
};

// Extend JSX for webview tag
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?:            string;
          partition?:      string;
          allowpopups?:    string;
          webpreferences?: string;
          ref?:            React.Ref<Electron.WebviewTag>;
        },
        HTMLElement
      >;
    }
  }
}
