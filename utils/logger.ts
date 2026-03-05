/**
 * Centralized logger for MoodMateAI.
 *
 * WHY THIS EXISTS:
 * ─────────────────
 * 1. In production, console.log/warn/error pollute the JS thread and can
 *    leak sensitive data (user IDs, tokens, error stack traces) into
 *    on-device logs that tools like `adb logcat` or libimobiledevice
 *    can read.
 *
 * 2. When you add a crash reporting service (Sentry, Crashlytics, etc.),
 *    you only need to change THIS file — not every file that logs.
 *
 * 3. The `__DEV__` global is `true` in Metro dev builds and `false` in
 *    production EAS builds, so production users never see debug noise.
 *
 * USAGE:
 *   import { logger } from "@/utils/logger";
 *   logger.info("Loaded profile");          // silent in production
 *   logger.warn("Retrying request");        // silent in production
 *   logger.error("DB insert failed", err);  // logged + reported in production
 */

type LogLevel = "debug" | "info" | "warn" | "error";

/** Swap this out for Sentry.captureException / Crashlytics.recordError */
function reportToService(_error: unknown, _context?: Record<string, string>) {
  // TODO: Uncomment when Sentry is integrated
  // Sentry.captureException(error, { extra: context });
}

function shouldLog(level: LogLevel): boolean {
  if (__DEV__) return true; // always log in dev
  // In production, only log errors (they go to reportToService too)
  return level === "error";
}

export const logger = {
  debug(...args: unknown[]) {
    if (shouldLog("debug")) console.debug(...args);
  },

  info(...args: unknown[]) {
    if (shouldLog("info")) console.log(...args);
  },

  warn(...args: unknown[]) {
    if (shouldLog("warn")) console.warn(...args);
  },

  error(...args: unknown[]) {
    if (shouldLog("error")) console.error(...args);
    // Also report to crash service (even if console is silenced)
    const first = args[0];
    const errorObj = first instanceof Error ? first : new Error(String(first));
    reportToService(errorObj);
  },

  /** Explicitly report an exception to the crash service */
  captureException(error: unknown, context?: Record<string, string>) {
    if (__DEV__) console.error("🔴 captureException:", error);
    reportToService(error, context);
  },
};
