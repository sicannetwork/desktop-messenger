# Assets Required

Place the following icon files in this `assets/` directory before building.

| File            | Size     | Purpose                              |
|-----------------|----------|--------------------------------------|
| `icon.ico`      | 256×256  | App icon (installer, taskbar, About) |
| `tray.ico`      | 16×16    | System tray icon (no badge)          |
| `tray-badge.ico`| 16×16    | System tray icon (with red dot)      |

## Recommended Approach

1. Start with the official Meta Messenger gradient icon (blue→purple).
2. Convert to `.ico` using ImageMagick or https://convertio.co/png-ico/.
3. For `tray.ico`: 16×16 white/gradient lightning bolt on transparent bg.
4. For `tray-badge.ico`: Same with a small red dot in the bottom-right corner.

## ImageMagick example
```bash
magick icon.png -define icon:auto-resize="256,128,64,48,32,16" icon.ico
```

## Placeholder generation (dev only)
The app falls back to a programmatic placeholder if icons are missing,
so development works without real icons.
