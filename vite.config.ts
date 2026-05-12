import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "shared": path.resolve(__dirname, "./shared"),
    },
  },
  // Renderer-specific build — NOT a Node environment.
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  // Vite needs to know we're running in Electron (enables process.env)
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
  },
  // Allow webview tag
  optimizeDeps: {
    exclude: ["electron"],
  },
});
