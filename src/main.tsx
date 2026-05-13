// FILE: src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

const container = document.getElementById("root");

if (!container) {
  // This message will appear in the pre-React diagnostic panel and DevTools
  const msg = "FATAL: #root element not found in index.html — the HTML may not have loaded correctly.";
  console.error(msg);
  document.body.innerHTML +=
    `<div style="color:#ff6b6b;font-family:monospace;padding:20px;position:fixed;top:80px;left:0;right:0;z-index:999998">${msg}</div>`;
} else {
  try {
    createRoot(container).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // Tell the pre-React diagnostic panel in index.html that React is alive
    if (typeof (window as unknown as { __markReactMounted?: () => void }).__markReactMounted === "function") {
      (window as unknown as { __markReactMounted: () => void }).__markReactMounted();
    }
  } catch (err) {
    console.error("FATAL: React failed to mount:", err);
    document.body.innerHTML +=
      `<div style="color:#ff6b6b;font-family:monospace;padding:20px;position:fixed;top:80px;left:0;right:0;z-index:999998;background:#1a0000">
        FATAL: React failed to mount<br/>${String(err)}
      </div>`;
  }
}
