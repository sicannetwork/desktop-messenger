# MessengerDesk

**Native Windows desktop app for Facebook Messenger**
Built with Electron 29 · React 18 · TypeScript · Vite · Windows-exclusive

---

## Why a Wrapper Architecture?

> **TL;DR: Meta provides no public consumer Messenger API. The webview wrapper is the only viable approach.**

Meta's [Messenger Platform API](https://developers.facebook.com/docs/messenger-platform) exists exclusively
for **business pages** (chatbots, customer support flows). It does **not** expose:

- Personal conversation threads
- Send/receive on behalf of a real Facebook user
- Typing indicators, reactions, or read receipts for personal chats
- Real-time push subscriptions for personal accounts
- Voice/video call establishment

This is intentional. Meta restricts API access to prevent third-party clients from
accessing personal Messenger accounts — a policy enforced since the Graph API v2.0
deprecation of personal messaging endpoints in 2015.

**Therefore**: MessengerDesk embeds `https://www.messenger.com` in a secure Electron
`<webview>` with an isolated session partition. This is identical to how the now-discontinued
official Messenger for Windows app worked, and how apps like Franz/Rambox/Beeper operate.

**What you get vs the official app:**

| Feature                        | MessengerDesk (wrapper) | Official Messenger |
|--------------------------------|:-----------------------:|:------------------:|
| All personal chats             | ✅                      | ✅                 |
| Send/receive messages          | ✅                      | ✅                 |
| Reactions, stickers, GIFs      | ✅                      | ✅                 |
| Voice/video calls              | ✅ (via webview)        | ✅                 |
| Desktop notifications          | ✅ (native toast)       | ✅                 |
| Unread badge / tray            | ✅                      | ✅                 |
| Offline mode / cached messages | ❌                      | ✅                 |
| Background sync without app    | ❌                      | ✅                 |
| Native push notifications      | ❌                      | ✅                 |

---

## Features

- **Frameless Windows title bar** with native minimize/maximize/close
- **Windows system tray** — minimize/close to tray, context menu
- **Windows taskbar badge** + tray icon badge for unread counts
- **Native toast notifications** with click-to-focus-chat
- **Session persistence** — stay logged in across app restarts
- **Logout + clear session** safely wipes all cookies
- **Settings panel**: startup, tray, notifications, theme, zoom, hardware accel
- **Auto-launch on Windows startup**
- **Window state persistence** (size, position, maximized)
- **External link protection** — non-Messenger URLs open in default browser
- **Zoom controls** (Ctrl+scroll or settings slider)
- **Spellcheck** in Electron
- **Light/dark/system theme** sync
- **Single instance** — second launch focuses existing window
- **Secure IPC** — typed, validated channels only; contextIsolation + sandbox

---

## Project Structure

```
messengerdesk/
├── electron/
│   ├── main/
│   │   ├── index.ts              # App entry, lifecycle
│   │   ├── windowManager.ts      # BrowserWindow creation + state
│   │   ├── trayManager.ts        # System tray + badge
│   │   ├── notificationManager.ts# Windows toast notifications
│   │   ├── sessionManager.ts     # Messenger session isolation
│   │   ├── ipcHandlers.ts        # All validated IPC channels
│   │   ├── store.ts              # electron-store settings
│   │   └── logger.ts             # electron-log setup
│   └── preload/
│       └── index.ts              # contextBridge API surface
├── src/                          # React renderer (shell UI only)
│   ├── components/
│   │   ├── TitleBar.tsx          # Custom frameless title bar
│   │   ├── SplashScreen.tsx      # Loading animation
│   │   ├── Settings.tsx          # Settings panel
│   │   ├── WebviewContainer.tsx  # Messenger webview wrapper
│   │   └── ErrorBoundary.tsx     # Crash UI
│   ├── store/
│   │   └── useStore.ts           # Zustand global state
│   ├── styles/
│   │   └── globals.css           # Shell-level base styles
│   ├── App.tsx                   # Root component
│   └── main.tsx                  # React entry point
├── shared/
│   └── ipc-types.ts              # Typed IPC contracts (main ↔ renderer)
├── assets/
│   ├── icon.ico                  # [You supply] App icon
│   ├── tray.ico                  # [You supply] Tray icon
│   └── tray-badge.ico            # [You supply] Tray icon w/ badge
├── index.html                    # Vite HTML entry
├── vite.config.ts
├── tsconfig.json                 # Renderer + preload TypeScript
├── tsconfig.electron.json        # Main process TypeScript (CJS)
├── electron-builder.yml          # Windows packaging
├── tailwind.config.js
└── package.json
```

---

## Prerequisites

| Tool        | Version  |
|-------------|----------|
| Node.js     | ≥ 20 LTS |
| npm         | ≥ 10     |
| Windows     | 10 / 11 x64 |

---

## Setup

```bash
# 1. Clone or unzip the project
cd messengerdesk

# 2. Install dependencies
npm install

# 3. Add icon assets (see assets/README-ASSETS.md)
#    Minimum: copy any .ico file to assets/icon.ico, tray.ico, tray-badge.ico
#    The app will use a programmatic fallback if they're missing.

# 4. Start in development mode
npm run dev
```

Development mode starts:
- Vite dev server at `http://localhost:5173`
- Electron loading from that URL
- DevTools auto-opens in a detached window

---

## Development Scripts

```bash
npm run dev              # Full dev mode (Vite + Electron concurrently)
npm run build            # Build renderer (dist/) + compile main (dist-electron/)
npm run build:vite       # Renderer only
npm run build:electron   # Main process only
npm run typecheck        # Type check all TS (no emit)
npm run lint             # ESLint
```

---

## Building for Production

### NSIS Installer (recommended)

```bash
npm run dist:win
```

Output: `release/MessengerDesk-1.0.0-Setup.exe`

### Portable EXE (no install needed)

```bash
npm run dist:portable
```

Output: `release/MessengerDesk-1.0.0-portable.exe`

### Both targets

```bash
npm run dist
```

---

## Windows Packaging Notes

### Code signing (production)

Set these environment variables before building:

```env
WIN_CERT_FILE=path/to/certificate.pfx
WIN_CERT_PASSWORD=your_cert_password
```

Uncomment the signing lines in `electron-builder.yml`.

For Microsoft Store distribution, use the `appx` target instead:
```yaml
win:
  target:
    - target: appx
      arch: [x64]
```

### Auto-update

`electron-updater` is included. Configure a GitHub release feed in `electron-builder.yml`:

```yaml
publish:
  provider: github
  owner: your-org
  repo: messengerdesk
```

Set `GH_TOKEN` in your CI environment. The main process is auto-update-ready
(the update manager module can be enabled with ~20 lines of code).

### App User Model ID

Set to `com.messengerdesk.app` in `main/index.ts`. This controls:
- Windows toast notification grouping
- Taskbar pinning identity
- Jump list association

Change it before publishing to match your actual app ID.

---

## Security Architecture

| Mechanism                | Implementation |
|--------------------------|----------------|
| `contextIsolation`       | ✅ true |
| `nodeIntegration`        | ✅ false |
| `sandbox`                | ✅ true (renderer) |
| IPC validation           | ✅ Allowlisted channels only in preload |
| Session isolation        | ✅ `persist:messenger` partition |
| External URL protection  | ✅ `setWindowOpenHandler` + `new-window` guard |
| Request filtering        | ✅ Tracker/ad domains blocked |
| Certificate validation   | ✅ Chromium default (Meta cert pinning) |
| Permission gating        | ✅ Only notifications + media allowed |

---

## Settings Storage

Settings are persisted at:
```
%APPDATA%\messengerdesk\config.json
```

Session cookies at:
```
%APPDATA%\messengerdesk\Partitions\persist_messenger\Cookies
```

Logs at:
```
%APPDATA%\messengerdesk\logs\main.log
```

---

## Keyboard Shortcuts

| Shortcut      | Action            |
|---------------|-------------------|
| `Ctrl+,`      | Open settings     |
| `Ctrl+R`      | Reload webview    |
| `Ctrl++`      | Zoom in           |
| `Ctrl+-`      | Zoom out          |
| `Ctrl+0`      | Reset zoom        |
| `F5`          | Reload            |
| `Alt+F4`      | Close (tray or quit based on setting) |

---

## Limitations vs Official App

1. **No offline message cache** — requires internet connection (same as messenger.com)
2. **No background sync** — notifications only work while app is running
3. **No native call notifications** — calls show in-webview only
4. **Content dependent on messenger.com** — any UI changes Meta makes are reflected automatically
5. **Performance** — Electron adds ~150MB baseline RAM vs a native app

---

## License

ISC — You are responsible for ensuring your use of `messenger.com` within this app
complies with Meta's Terms of Service. This is a personal-use wrapper and is not
affiliated with or endorsed by Meta.
