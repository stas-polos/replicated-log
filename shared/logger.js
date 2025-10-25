const winston = require('winston');

const createLogger = (service) => {
  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, service }) => {
        return `[${timestamp}] [${service}] ${level.toUpperCase()}: ${message}`;
      })
    ),
    defaultMeta: { service },
    transports: [
      new winston.transports.Console()
    ]
  });
};

module.exports = { createLogger };
