import { Notification, nativeImage, app } from "electron";
import path from "path";
import { showMainWindow, getMainWindow } from "./windowManager";
import { getSetting } from "./store";
import { NotifyPayload } from "../../shared/ipc-types";
import { logger } from "./logger";

const isDev = process.env.NODE_ENV === "development";

/**
 * Shows a native Windows toast notification.
 * Clicking it brings the app to focus and optionally navigates to a URL.
 */
export function showNotification(payload: NotifyPayload): void {
  if (!getSetting("showNotifications")) return;
  if (!Notification.isSupported()) {
    logger.warn("Notifications not supported on this platform");
    return;
  }

  const iconPath = isDev
    ? path.join(process.cwd(), "assets", "icon.ico")
    : path.join(process.resourcesPath, "icon.ico");

  let icon: Electron.NativeImage | undefined;
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    icon = undefined;
  }

  const notification = new Notification({
    title:         payload.title,
    body:          payload.body,
    icon:          icon,
    urgency:       "normal",
    timeoutType:   "default",
    toastXml:      buildToastXml(payload),
  });

  notification.on("click", () => {
    showMainWindow();
    if (payload.url) {
      const win = getMainWindow();
      win?.webContents.send("nav:url", payload.url);
    }
  });

  notification.on("failed", (_, err) => {
    logger.error("Notification failed:", err);
    // Fallback without rich toast XML
    fallbackNotification(payload);
  });

  notification.show();
}

// ── Windows-specific rich Toast XML ──────────────────────────────────────────
// toastXml gives us the native Windows 10/11 toast appearance with the
// Messenger branding colour and action buttons.

function buildToastXml(payload: NotifyPayload): string {
  const appId = app.getName() || "MessengerDesk";
  return `
<toast activationType="foreground">
  <visual>
    <binding template="ToastGeneric">
      <text hint-maxLines="1">${escapeXml(payload.title)}</text>
      <text>${escapeXml(payload.body)}</text>
    </binding>
  </visual>
  <audio src="ms-winsoundevent:Notification.IM" silent="${getSetting("notificationSound") ? "false" : "true"}"/>
</toast>`.trim();
}

function fallbackNotification(payload: NotifyPayload): void {
  try {
    const n = new Notification({ title: payload.title, body: payload.body });
    n.on("click", () => showMainWindow());
    n.show();
  } catch (err) {
    logger.error("Fallback notification also failed:", err);
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&apos;");
}
