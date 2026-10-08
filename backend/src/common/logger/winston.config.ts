import * as winston from 'winston';
import { WinstonModule } from 'nest-winston';
import { trace, isSpanContextValid } from '@opentelemetry/api';
import { requestContext } from './request-context';

const LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

/** LOG_LEVEL env (default info). Unknown values fall back to info. */
export function resolveLogLevel(raw = process.env.LOG_LEVEL): string {
  const level = raw?.trim().toLowerCase();
  return level && LEVELS.includes(level) ? level : 'info';
}

/** Adds the current requestId (AsyncLocalStorage) and the OTel trace_id / span_id to every log line. */
export const correlationFormat = winston.format((info) => {
  const requestId = requestContext.getStore()?.requestId;
  if (requestId && info.requestId === undefined) info.requestId = requestId;
  const span = trace.getActiveSpan();
  if (span) {
    const ctx = span.spanContext();
    if (isSpanContextValid(ctx)) {
      info.trace_id = ctx.traceId;
      info.span_id = ctx.spanId;
    }
  }
  return info;
});

export const winstonLogger = WinstonModule.createLogger({
  level: resolveLogLevel(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        correlationFormat(),
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
