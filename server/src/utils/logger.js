/**
 * Structured Logger Utility for WordPot Server
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.info;

function formatLogMessage(level, message, meta = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...meta,
  });
}

export const logger = {
  debug(msg, meta) {
    if (currentLevel <= LOG_LEVELS.debug) {
      console.debug(formatLogMessage("debug", msg, meta));
    }
  },
  info(msg, meta) {
    if (currentLevel <= LOG_LEVELS.info) {
      console.info(formatLogMessage("info", msg, meta));
    }
  },
  warn(msg, meta) {
    if (currentLevel <= LOG_LEVELS.warn) {
      console.warn(formatLogMessage("warn", msg, meta));
    }
  },
  error(msg, meta) {
    if (currentLevel <= LOG_LEVELS.error) {
      console.error(formatLogMessage("error", msg, meta));
    }
  },
};

export { formatLogMessage };
