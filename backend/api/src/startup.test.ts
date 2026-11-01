import express from 'express';
import fs from 'node:fs/promises';
import type { Server } from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as StartupModule from './startup';

type AppModule = typeof import('./app');

let tempRoot: string;
const servers: Server[] = [];

beforeAll(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tazascan-startup-'));
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
  vi.unstubAllEnvs();
});

afterAll(async () => {
  vi.restoreAllMocks();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

/** Loads the real modules with UPLOAD_ROOT pointing at `uploadRoot`. */
async function load(uploadRoot: string): Promise<{ startup: typeof StartupModule; app: AppModule }> {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@127.0.0.1:1/tazascan_startup');
  vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-9f2c7a1e4b8d6035-not-real');
  vi.stubEnv('UPLOAD_ROOT', uploadRoot);
  return { startup: await import('./startup.js'), app: await import('./app.js') };
}

function track(server: Server) {
  servers.push(server);
  return server;
}

function portOf(server: Server) {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('not listening on TCP');
  return address.port;
}

async function exists(target: string) {
  return fs.stat(target).then(
    (stat) => stat.isDirectory(),
    () => false
  );
}

describe('startServer', () => {
  it('creates the upload directories before it starts listening, then serves requests', async () => {
    const uploadRoot = path.join(tempRoot, 'ok-uploads');
    const { startup, app } = await load(uploadRoot);
    const events: string[] = [];

    const server = track(
      await startup.startServer({
        port: 0,
        initialize: async () => {
          await app.initializeApp();
          events.push(
            `initialized products=${await exists(path.join(uploadRoot, 'products'))} submissions=${await exists(path.join(uploadRoot, 'submissions'))}`
          );
        },
        create: () => {
          events.push('app created');
          return app.createApp();
        }
      })
    );
    events.push(`listening=${server.listening}`);

    expect(events).toEqual([
      'initialized products=true submissions=true',
      'app created',
      'listening=true'
    ]);
    const response = await request(`http://127.0.0.1:${portOf(server)}`).get('/health');
    expect(response.status).toBe(200);
  });

  it('accepts no connection until initialization has completed', async () => {
    const { startup } = await load(path.join(tempRoot, 'gate-uploads'));
    let releaseInitialization!: () => void;
    const initialized = new Promise<void>((resolve) => {
      releaseInitialization = resolve;
    });
    const create = vi.fn(() => {
      const app = express();
      app.get('/probe', (_request, response) => response.json({ ok: true }));
      return app;
    });

    const starting = startup.startServer({ port: 0, initialize: () => initialized, create });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Still initializing: no app exists and nothing is listening.
    expect(create).not.toHaveBeenCalled();

    releaseInitialization();
    const server = track(await starting);
    expect(create).toHaveBeenCalledOnce();
    const response = await request(`http://127.0.0.1:${portOf(server)}`).get('/probe');
    expect(response.body).toEqual({ ok: true });
  });

  it('fails initialization when the upload directory cannot be created, and never listens', async () => {
    // A regular file where the upload root must be a directory: mkdir fails for real.
    const blocker = path.join(tempRoot, 'not-a-directory');
    await fs.writeFile(blocker, 'x');
    const { startup, app } = await load(blocker);
    const create = vi.fn(app.createApp);

    const result = startup.startServer({ port: 0, create });

    await expect(result).rejects.toBeInstanceOf(startup.StartupError);
    await expect(result).rejects.toMatchObject({ phase: 'initialization' });
    const failure = (await result.catch((error: unknown) => error)) as StartupModule.StartupError;
    expect(['ENOTDIR', 'EEXIST']).toContain((failure.cause as NodeJS.ErrnoException).code);
    expect(create).not.toHaveBeenCalled();
  });

  it('reports a listen failure (port already in use) as a startup error', async () => {
    const { startup } = await load(path.join(tempRoot, 'listen-uploads'));
    const occupied = track(await new Promise<Server>((resolve) => {
      const blocker = net.createServer().listen(0, () => resolve(blocker as unknown as Server));
    }));

    const result = startup.startServer({
      port: portOf(occupied),
      initialize: async () => undefined,
      create: () => express()
    });

    await expect(result).rejects.toMatchObject({
      name: 'StartupError',
      phase: 'listen',
      cause: expect.objectContaining({ code: 'EADDRINUSE' })
    });
  });
});

describe('createApp', () => {
  it('starts no background initialization of its own (nothing left to reject unhandled)', async () => {
    const uploadRoot = path.join(tempRoot, 'untouched-uploads');
    const { app } = await load(uploadRoot);

    app.createApp();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(await exists(uploadRoot)).toBe(false);
  });

  it('a failing initialization is not reported as an unhandled rejection', async () => {
    const blocker = path.join(tempRoot, 'blocker-for-unhandled');
    await fs.writeFile(blocker, 'x');
    const { startup } = await load(blocker);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    try {
      await startup.startServer({ port: 0 }).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});

describe('handleStartupFailure', () => {
  it('logs a sanitized line and exits with status 1', async () => {
    const { startup } = await load(path.join(tempRoot, 'log-uploads'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = vi.fn();
    const cause = Object.assign(
      new Error("EACCES: permission denied, mkdir 'C:\\secret-home\\private\\uploads\\products'"),
      { code: 'EACCES' }
    );

    startup.handleStartupFailure(new startup.StartupError('initialization', cause), exit);

    expect(exit).toHaveBeenCalledWith(1);
    expect(errorLog).toHaveBeenCalledOnce();
    const line = String(errorLog.mock.calls[0]![0]);
    expect(JSON.parse(line)).toEqual({
      level: 'error',
      event: 'startup_failed',
      service: 'tazascan-api',
      phase: 'initialization',
      name: 'Error',
      code: 'EACCES'
    });
    expect(line).not.toContain('secret-home');
    expect(line).not.toContain('permission denied');
    errorLog.mockRestore();
  });
});
