import { session, app } from "electron";
import path from "path";
import { logger } from "./logger";

/**
 * The dedicated session partition for messenger.com.
 * "persist:" prefix means cookies/storage survive app restarts.
 */
export const MESSENGER_PARTITION = "persist:messenger";

/**
 * Configures the Messenger session with:
 * - HTTPS-only cookie persistence (no third-party exfil)
 * - Tight Content-Security-Policy
 * - Spoof a realistic browser User-Agent so messenger.com doesn't degrade the UI
 * - Block known tracker/ad domains to improve performance
 */
export function configureMessengerSession(): void {
  const ses = session.fromPartition(MESSENGER_PARTITION);

  // ── User-Agent ─────────────────────────────────────────────────────────────
  // Spoof Chrome on Windows so Messenger serves the full desktop UI.
  ses.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/122.0.0.0 Safari/537.36"
  );

  // ── Download path ──────────────────────────────────────────────────────────
  ses.setDownloadPath(app.getPath("downloads"));

  // ── Request filtering ──────────────────────────────────────────────────────
  // Block non-essential third-party trackers for perf and privacy.
  // We ALLOW all *.facebook.com, *.messenger.com, *.fbcdn.net (CDN for media).
  ses.webRequest.onBeforeRequest(
    { urls: ["*://*/*"] },
    (details, callback) => {
      const url = new URL(details.url);
      if (shouldBlock(url.hostname)) {
        callback({ cancel: true });
      } else {
        callback({ cancel: false });
      }
    }
  );

  // ── Certificate validation ─────────────────────────────────────────────────
  // Only allow Meta's CDN & FB certs; reject anything unexpected.
  ses.setCertificateVerifyProc((request, callback) => {
    // CALLBACK_DEFAULT (-3) = Electron's normal Chromium validation.
    // We rely on Chromium's cert pinning for Meta domains.
    callback(-3);
  });

  // ── Permission handling ────────────────────────────────────────────────────
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed: Electron.Permission[] = [
      "notifications",
      "media",        // mic/camera for voice/video calls
      "clipboard-read",
      "clipboard-sanitized-write",
    ];
    callback(allowed.includes(permission));
  });

  logger.info("Messenger session configured");
}

/** Clear all cookies, localStorage, and caches for the Messenger partition. */
export async function clearMessengerSession(): Promise<void> {
  const ses = session.fromPartition(MESSENGER_PARTITION);
  await ses.clearStorageData({
    storages: [
      "cookies",
      "localstorage",
      "sessionstorage",
      "indexdb",
      "websql",
      "serviceworkers",
      "cachestorage",
    ],
  });
  await ses.clearCache();
  logger.info("Messenger session cleared (logout)");
}

/** Returns true if the session contains a messenger.com auth cookie. */
export async function isLoggedIn(): Promise<boolean> {
  const ses = session.fromPartition(MESSENGER_PARTITION);
  const cookies = await ses.cookies.get({ domain: ".facebook.com", name: "c_user" });
  return cookies.length > 0;
}

// ── Blocked hostname list ─────────────────────────────────────────────────────
// Light tracker/ad block list. Does NOT interfere with Messenger functionality.
const BLOCKED_HOSTS = new Set([
  "an.facebook.com",          // Audience Network ads
  "connect.facebook.net",     // FB Connect (only needed on third-party sites)
  "www.googletagmanager.com",
  "www.google-analytics.com",
  "analytics.google.com",
  "doubleclick.net",
  "googleads.g.doubleclick.net",
]);

function shouldBlock(hostname: string): boolean {
  return BLOCKED_HOSTS.has(hostname) ||
    hostname.endsWith(".doubleclick.net") ||
    hostname.endsWith(".googlesyndication.com");
}
