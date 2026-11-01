import type { Server } from 'node:http';

/**
 * Upper bound for a graceful shutdown. Kept below the common 10 s grace period that
 * container platforms give before SIGKILL, so the timeout is logged and the exit code set.
 */
export const shutdownTimeoutMs = 8_000;

export type ShutdownOptions = {
  server: Server;
  /** Releases OCR worker threads (rejects queued jobs, terminates workers). */
  closeOcr: () => Promise<void>;
  /** Disconnects the shared Prisma client. */
  disconnectDatabase: () => Promise<void>;
  timeoutMs?: number;
  exit?: (code: number) => void;
};

type Step = 'http_server' | 'ocr' | 'database';

/**
 * Returns an idempotent shutdown handler. The first call stops accepting connections, lets
 * in-flight requests finish, then releases OCR workers and the database connection, and
 * exits 0 (or 1 if a step failed). Later calls (repeated signals) join the same shutdown.
 * If the whole sequence exceeds `timeoutMs`, open connections are dropped and it exits 1.
 */
export function createShutdownHandler({
  server,
  closeOcr,
  disconnectDatabase,
  timeoutMs = shutdownTimeoutMs,
  exit = (code) => process.exit(code)
}: ShutdownOptions): (signal: string) => Promise<void> {
  let inProgress: Promise<void> | null = null;

  return (signal) => {
    if (inProgress) {
      console.info(JSON.stringify({ level: 'info', event: 'shutdown_already_in_progress', signal }));
      return inProgress;
    }

    console.info(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
    let exited = false;
    const exitOnce = (code: number) => {
      if (!exited) {
        exited = true;
        exit(code);
      }
    };

    const deadline = setTimeout(() => {
      console.error(JSON.stringify({ level: 'error', event: 'shutdown_timeout', timeoutMs }));
      // Requests still running past the deadline are cut off rather than hanging forever.
      server.closeAllConnections();
      exitOnce(1);
    }, timeoutMs);

    inProgress = (async () => {
      const failed: Step[] = [];
      const run = async (step: Step, operation: () => Promise<void>) => {
        try {
          await operation();
        } catch (error) {
          failed.push(step);
          console.error(JSON.stringify({
            level: 'error',
            event: 'shutdown_step_failed',
            step,
            name: error instanceof Error ? error.name : typeof error,
            code: errorCode(error)
          }));
        }
      };

      // Stops accepting connections and closes idle keep-alive ones; in-flight requests finish.
      await run('http_server', () => closeServer(server));
      await run('ocr', closeOcr);
      await run('database', disconnectDatabase);

      clearTimeout(deadline);
      console.info(JSON.stringify({ level: 'info', event: 'shutdown_complete', failedSteps: failed }));
      exitOnce(failed.length === 0 ? 0 : 1);
    })();

    return inProgress;
  };
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function errorCode(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' || typeof code === 'number' ? code : undefined;
}
