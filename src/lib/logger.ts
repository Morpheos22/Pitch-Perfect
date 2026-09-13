/**
 * Structured Logger — PitchCoach Ai × Athena Agentic
 *
 * Lightweight logging utility that gates non-essential output behind a dev flag.
 * In production, only `error` and `warn` are emitted; `debug` and `info` are no-ops.
 *
 * Usage:
 *   import { createLogger } from '@/lib/logger';
 *   const log = createLogger('StripeWebhook');
 *   log.debug('Processing event', event);  // no-op in production
 *   log.error('Signature failed', err);     // always emitted
 */

const isDev = process.env.NODE_ENV === 'development';

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Create a scoped logger with a module prefix.
 * Prefix format: `[ModuleName]`
 */
export function createLogger(module: string): Logger {
  const prefix = `[${module}]`;

  return {
    debug: (...args: unknown[]) => {
      if (isDev) {
        console.log(prefix, ...args);
      }
    },
    info: (...args: unknown[]) => {
      if (isDev) {
        console.info(prefix, ...args);
      }
    },
    warn: (...args: unknown[]) => {
      console.warn(prefix, ...args);
    },
    error: (...args: unknown[]) => {
      console.error(prefix, ...args);
    },
  };
}

/**
 * Global logger for ad-hoc use without a module prefix.
 */
export const log = createLogger('App');
