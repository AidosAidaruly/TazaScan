import type { Express } from 'express';
import type { Server } from 'node:http';
import { createApp, initializeApp } from './app';

export type StartupPhase = 'initialization' | 'listen';

/** A startup step failed; the server is not accepting requests. */
export class StartupError extends Error {
  constructor(
    readonly phase: StartupPhase,
    readonly cause: unknown
  ) {
    super(`Startup failed during ${phase}`);
    this.name = 'StartupError';
  }
}

export type StartServerOptions = {
  port: number;
  initialize?: () => Promise<void>;
  create?: () => Express;
};

/**
 * Completes required initialization, then starts listening. No request can reach the app
 * before initialization succeeds. Rejects with StartupError if either step fails.
 */
export async function startServer({
  port,
  initialize = initializeApp,
  create = createApp
}: StartServerOptions): Promise<Server> {
  try {
    await initialize();
  } catch (error) {
    throw new StartupError('initialization', error);
  }

  const app = create();

  return new Promise<Server>((resolve, reject) => {
    const server = app.listen(port);
    server.once('listening', () => resolve(server));
    server.once('error', (error) => reject(new StartupError('listen', error)));
  });
}

/**
 * Logs a startup failure without its message or stack (they can contain absolute paths or
 * other environment details) and exits with a nonzero status.
 */
export function handleStartupFailure(
  error: unknown,
  exit: (code: number) => void = (code) => process.exit(code)
) {
  const cause = error instanceof StartupError ? error.cause : error;
  console.error(JSON.stringify({
    level: 'error',
    event: 'startup_failed',
    service: 'tazascan-api',
    phase: error instanceof StartupError ? error.phase : 'unknown',
    name: cause instanceof Error ? cause.name : typeof cause,
    code: errorCode(cause)
  }));
  exit(1);
}

function errorCode(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' || typeof code === 'number' ? code : undefined;
}
