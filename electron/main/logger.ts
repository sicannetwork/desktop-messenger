import log from "electron-log";
import path from "path";
import { app } from "electron";

/** Initialise electron-log for the main process. Call once at startup. */
export function initLogger(): void {
  const logDir = path.join(app.getPath("userData"), "logs");

  log.transports.file.resolvePathFn = () => path.join(logDir, "main.log");
  log.transports.file.level          = "debug";
  log.transports.file.maxSize        = 5 * 1024 * 1024; // 5 MB
  log.transports.file.format         = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";
  log.transports.console.level       = process.env.NODE_ENV === "development" ? "debug" : "warn";
  log.transports.console.format      = "[{h}:{i}:{s}] [{level}] {text}";

  // Route unhandled rejections / exceptions into the log file.
  process.on("uncaughtException",  (err) => log.error("Uncaught Exception:", err));
  process.on("unhandledRejection", (reason) => log.error("Unhandled Rejection:", reason));
}

export const logger = log;
