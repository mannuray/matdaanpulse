interface FatalDeps {
  proc: Pick<NodeJS.EventEmitter, 'on'>;
  logger: { error(message: unknown, stack?: string): void };
  /** Flush buffered spans (shutdownTracing). */
  flush: () => Promise<void>;
  exit: (code: number) => void;
  flushTimeoutMs?: number;
}

/**
 * Unhandled rejections and uncaught exceptions: one JSON error line (with the stack) through the app logger instead
 * of Node's plain-text stderr dump, then flush traces (bounded) and exit 1. The platform restarts the instance; staying
 * up in an unknown state is worse.
 */
export function installProcessHandlers({ proc, logger, flush, exit, flushTimeoutMs = 2000 }: FatalDeps) {
  let exiting = false;
  const fatal = (kind: 'unhandledRejection' | 'uncaughtException', label: string) => (reason: unknown) => {
    const err = reason instanceof Error ? reason : undefined;
    logger.error({ message: `${label}: ${err ? err.message : String(reason)}`, event: 'fatal', kind }, err?.stack);
    if (exiting) return;
    exiting = true;
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, flushTimeoutMs).unref?.());
    void Promise.race([flush().catch(() => undefined), timeout]).then(() => exit(1));
  };
  proc.on('unhandledRejection', fatal('unhandledRejection', 'Unhandled promise rejection'));
  proc.on('uncaughtException', fatal('uncaughtException', 'Uncaught exception'));
}
