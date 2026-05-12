import { Tray, Menu, nativeImage, app, BrowserWindow } from "electron";
import path from "path";
import { showMainWindow } from "./windowManager";
import { logger } from "./logger";

let tray: Tray | null = null;
let unreadCount = 0;

const isDev = process.env.NODE_ENV === "development";

export function createTray(mainWindow: BrowserWindow): Tray {
  const icon = getTrayIcon(0);
  tray = new Tray(icon);
  tray.setToolTip("MessengerDesk");
  tray.setTitle("MessengerDesk");

  // Double-click restores window.
  tray.on("double-click", () => showMainWindow());
  // Single click on Windows also toggles the window.
  tray.on("click", () => {
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      showMainWindow();
    }
  });

  rebuildContextMenu(mainWindow);
  logger.info("System tray created");
  return tray;
}

export function updateTrayBadge(count: number): void {
  unreadCount = count;
  if (!tray || tray.isDestroyed()) return;

  const icon = getTrayIcon(count);
  tray.setImage(icon);
  tray.setToolTip(count > 0 ? `MessengerDesk — ${count} unread` : "MessengerDesk");

  // Windows taskbar overlay badge
  const { BrowserWindow: BW } = require("electron");
  const wins = BW.getAllWindows();
  if (wins.length > 0) {
    const overlay = count > 0 ? getBadgeOverlay(count) : null;
    wins[0].setOverlayIcon(overlay, count > 0 ? `${count} unread messages` : "");
  }
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

// ── Context Menu ──────────────────────────────────────────────────────────────

function rebuildContextMenu(mainWindow: BrowserWindow): void {
  if (!tray) return;
  const ctx = Menu.buildFromTemplate([
    {
      label: "Open MessengerDesk",
      click: () => showMainWindow(),
    },
    { type: "separator" },
    {
      label: "New Message",
      click: () => {
        showMainWindow();
        mainWindow.webContents.send("nav:newMessage");
      },
    },
    { type: "separator" },
    {
      label: "Settings",
      click: () => {
        showMainWindow();
        mainWindow.webContents.send("nav:settings");
      },
    },
    {
      label: "Check for Updates",
      click: () => mainWindow.webContents.send("update:check"),
    },
    { type: "separator" },
    {
      label: "Quit MessengerDesk",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(ctx);
}

// ── Icon helpers ──────────────────────────────────────────────────────────────

function getTrayIcon(count: number): Electron.NativeImage {
  const baseName = count > 0 ? "tray-badge.ico" : "tray.ico";
  const iconPath = isDev
    ? path.join(process.cwd(), "assets", baseName)
    : path.join(process.resourcesPath, baseName);
  try {
    return nativeImage.createFromPath(iconPath);
  } catch {
    // Fallback: build a tiny PNG programmatically (16×16 blue square)
    return nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAKElEQVQ4jWNgYGD4z8BAAIwqGFUwqmBIKGAAAAD//wMABKABiQkCcHoAAAAASUVORK5CYII="
    );
  }
}

function getBadgeOverlay(count: number): Electron.NativeImage {
  // Build a red circle badge with number using canvas-style DataURL approach.
  const size   = 16;
  const label  = count > 99 ? "99+" : String(count);
  // We create a simple red dot — production apps would use a real canvas renderer
  // or pre-rendered badge assets. This SVG-encoded approach works cross-Windows.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="8" cy="8" r="8" fill="#e3193e"/>
      <text x="8" y="12" text-anchor="middle"
            font-family="Segoe UI" font-size="${label.length > 1 ? 7 : 9}"
            font-weight="bold" fill="white">${label}</text>
    </svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  );
}

// Augment global Electron app type with our quitting flag
declare global {
  namespace Electron {
    interface App {
      isQuitting: boolean;
    }
  }
}
