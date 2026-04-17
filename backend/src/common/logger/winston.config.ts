import * as winston from 'winston';
import { WinstonModule } from 'nest-winston';

export const winstonLogger = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        process.env.NODE_ENV === 'production'
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, context, ms, ...meta }) => {
                const ctx = context ? ` [${context}]` : '';
                const m = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                return `${timestamp} ${level}${ctx}: ${message}${m} ${ms}`;
              }),
            ),
      ),
    }),
  ],
});
