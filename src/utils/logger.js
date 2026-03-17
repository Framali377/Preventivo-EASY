// src/utils/logger.js
const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "preventivo-easy" },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino/file",
      options: { destination: 1 } // stdout, human-readable timestamps in dev
    }
  })
});

module.exports = logger;
