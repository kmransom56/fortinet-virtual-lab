import winston from 'winston';
import 'winston-syslog';
import config from '../config/config.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs-extra';

const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize, json } = format;

// Ensure logs directory exists
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.join(__dirname, '../../logs');

// Create logs directory if it doesn't exist
fs.ensureDirSync(logsDir);

// Custom log format
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    msg += ' ' + JSON.stringify(metadata, null, 2);
  }
  
  return msg;
});

// Create logger instance
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json(),
  ),
  defaultMeta: { service: 'fortiswitch-simulator' },
  transports: [
    // Write all logs with level `error` and below to `error.log`
    new transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Write all logs with level `info` and below to `combined.log`
    new transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat
    ),
  }));
}

// Add syslog transport if enabled
if (config.syslog.enabled) {
  const syslogOptions = {
    host: config.syslog.host,
    port: config.syslog.port,
    protocol: config.syslog.protocol,
    app_name: config.syslog.appName,
    facility: config.syslog.facility,
    type: 'RFC5424',
    localhost: 'fortiswitch-simulator',
    format: format.combine(
      format.splat(),
      format.simple()
    )
  };
  
  logger.add(new winston.transports.Syslog(syslogOptions));
}

// Create a stream for Express logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

export default logger;
