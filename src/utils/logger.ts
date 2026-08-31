import winston from 'winston';
import 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize } = winston.format;

// Formato personalizado
const myFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `[${timestamp}] ${level}: ${message} ${
    Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
  }`;
});

const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  maxSize: '20m',
  zippedArchive: true,
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    myFormat
  ),
  transports: [
    fileRotateTransport,
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        myFormat
      ),
    }),
  ],
});
