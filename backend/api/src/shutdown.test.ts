import express from 'express';
import fs from 'node:fs/promises';
import http, { type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { OcrWorkerPool, type OcrWorker } from './services/ocr-worker-pool';
import { createShutdownHandler } from './shutdown';

let infoSpy: MockInstance<typeof console.info>;
let errorSpy: MockInstance<typeof console.error>;
const servers: Server[] = [];

beforeEach(() => {
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
  vi.restoreAllMocks();
});

/** A real HTTP server with one fast route and one route released by the test. */
async function startTestServer() {
  let releaseSlow!: () => void;
  const slowReleased = new Promise<void>((resolve) => {
    releaseSlow = resolve;
  });
  let slowStarted!: () => void;
  const slowRequestStarted = new Promise<void>((resolve) => {
    slowStarted = resolve;
  });
  const app = express();
  app.get('/fast', (_request, response) => response.json({ ok: true }));
  app.get('/slow', async (_request, response) => {
    slowStarted();
    await slowReleased;
    response.json({ slow: 'done' });
  });
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  servers.push(server);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { server, port, releaseSlow, slowRequestStarted };
}

function get(port: number, route: string) {
  return new Promise<{ status: number; body: string } | { error: string }>((resolve) => {
    http
      .get({ host: '127.0.0.1', port, path: route, agent: false }, (response) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => resolve({ status: response.statusCode ?? 0, body }));
      })
      .on('error', (error: NodeJS.ErrnoException) => resolve({ error: error.code ?? error.message }));
  });
}

function loggedEvents(spy: MockInstance<(...args: unknown[]) => void>) {
  return spy.mock.calls.map((call) => JSON.parse(String(call[0])) as Record<string, unknown>);
}

describe('createShutdownHandler', () => {
  it('stops the HTTP server, then releases OCR, then disconnects the database, and exits 0', async () => {
    const { server, port } = await startTestServer();
    const order: string[] = [];
    const exit = vi.fn();
    server.on('close', () => order.push('http closed'));
    const shutdown = createShutdownHandler({
      server,
      closeOcr: async () => { order.push('ocr closed'); },
      disconnectDatabase: async () => { order.push('database disconnected'); },
      exit
    });

    await shutdown('SIGTERM');

    expect(order).toEqual(['http closed', 'ocr closed', 'database disconnected']);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(server.listening).toBe(false);
    expect(await get(port, '/fast')).toEqual({ error: 'ECONNREFUSED' });
    expect(loggedEvents(infoSpy).map((event) => event.event)).toEqual(['shutdown', 'shutdown_complete']);
  });

  it('refuses new connections during shutdown but lets an in-flight request finish', async () => {
    const { server, port, releaseSlow, slowRequestStarted } = await startTestServer();
    const exit = vi.fn();
    const disconnectDatabase = vi.fn(async () => undefined);
    const shutdown = createShutdownHandler({ server, closeOcr: async () => undefined, disconnectDatabase, exit });

    const inFlight = get(port, '/slow');
    await slowRequestStarted;
    const shuttingDown = shutdown('SIGINT');

    expect(await get(port, '/fast')).toEqual({ error: 'ECONNREFUSED' });
    // The in-flight request still owns the server; cleanup has not run yet.
    expect(disconnectDatabase).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();

    releaseSlow();
    expect(await inFlight).toEqual({ status: 200, body: JSON.stringify({ slow: 'done' }) });
    await shuttingDown;
    expect(disconnectDatabase).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('releases real OCR worker threads through OcrWorkerPool.close()', async () => {
    const { server } = await startTestServer();
    const terminate = vi.fn(async () => undefined);
    const worker: OcrWorker = {
      recognize: async () => ({ data: { text: 'ok' } }),
      terminate
    };
    const pool = new OcrWorkerPool({ createWorker: async () => worker, size: 1 });
    await pool.recognize(Buffer.from('image')); // starts the long-lived worker

    await createShutdownHandler({
      server,
      closeOcr: () => pool.close(),
      disconnectDatabase: async () => undefined,
      exit: vi.fn()
    })('SIGTERM');

    expect(terminate).toHaveBeenCalledOnce();
    await expect(pool.recognize(Buffer.from('late'))).rejects.toMatchObject({ statusCode: 503 });
  });

  it('a failing cleanup step is logged without details, later steps still run, and it exits 1', async () => {
    const { server } = await startTestServer();
    const exit = vi.fn();
    const disconnectDatabase = vi.fn(async () => undefined);
    const ocrFailure = Object.assign(
      new Error("terminate failed for C:\\secret-home\\worker with token s3cr3t"),
      { code: 'EWORKER' }
    );

    await createShutdownHandler({
      server,
      closeOcr: async () => { throw ocrFailure; },
      disconnectDatabase,
      exit
    })('SIGTERM');

    expect(disconnectDatabase).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    const errors = loggedEvents(errorSpy);
    expect(errors).toEqual([
      { level: 'error', event: 'shutdown_step_failed', step: 'ocr', name: 'Error', code: 'EWORKER' }
    ]);
    const logged = [...errorSpy.mock.calls, ...infoSpy.mock.calls].map((call) => String(call[0])).join('\n');
    expect(logged).not.toContain('secret-home');
    expect(logged).not.toContain('s3cr3t');
  });

  it('a rejecting database disconnect does not become an unhandled rejection', async () => {
    const { server } = await startTestServer();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const exit = vi.fn();

    try {
      await createShutdownHandler({
        server,
        closeOcr: async () => undefined,
        disconnectDatabase: () => Promise.reject(new Error('connection reset')),
        exit
      })('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(unhandled).not.toHaveBeenCalled();
      expect(loggedEvents(errorSpy)[0]).toMatchObject({ step: 'database' });
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('exits 1 at the deadline when a cleanup step hangs', async () => {
    const { server } = await startTestServer();
    const exit = vi.fn();
    const startedAt = Date.now();

    void createShutdownHandler({
      server,
      closeOcr: async () => undefined,
      disconnectDatabase: () => new Promise<never>(() => undefined),
      timeoutMs: 60,
      exit
    })('SIGTERM');

    await vi.waitFor(() => expect(exit).toHaveBeenCalled(), { timeout: 2_000 });
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(loggedEvents(errorSpy)).toContainEqual({ level: 'error', event: 'shutdown_timeout', timeoutMs: 60 });
  });

  it('cuts off a request that never finishes once the deadline passes', async () => {
    const { server, port, slowRequestStarted } = await startTestServer();
    const exit = vi.fn();
    const inFlight = get(port, '/slow'); // never released
    await slowRequestStarted;

    void createShutdownHandler({
      server,
      closeOcr: async () => undefined,
      disconnectDatabase: async () => undefined,
      timeoutMs: 60,
      exit
    })('SIGTERM');

    await vi.waitFor(() => expect(exit).toHaveBeenCalled(), { timeout: 2_000 });
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(await inFlight).toHaveProperty('error'); // connection was closed by the deadline
  });

  it('repeated signals join the first shutdown: no duplicate cleanup and a single exit', async () => {
    const { server, port, releaseSlow, slowRequestStarted } = await startTestServer();
    const closeOcr = vi.fn(async () => undefined);
    const disconnectDatabase = vi.fn(async () => undefined);
    const exit = vi.fn();
    const shutdown = createShutdownHandler({ server, closeOcr, disconnectDatabase, exit });
    const inFlight = get(port, '/slow');
    await slowRequestStarted;

    const first = shutdown('SIGTERM');
    const second = shutdown('SIGINT');
    const third = shutdown('SIGTERM');

    expect(second).toBe(first);
    expect(third).toBe(first);
    // A repeated signal must not cut off the request the first shutdown is waiting for.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(exit).not.toHaveBeenCalled();

    releaseSlow();
    expect(await inFlight).toMatchObject({ status: 200 });
    await first;
    expect(closeOcr).toHaveBeenCalledOnce();
    expect(disconnectDatabase).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(loggedEvents(infoSpy).filter((event) => event.event === 'shutdown_already_in_progress')).toHaveLength(2);
  });
});

describe('closeDefaultOcrPool', () => {
  it('does not create a pool that was never used, and closes the shared pool once used', async () => {
    vi.resetModules();
    // Spy on the pool class from the same fresh module registry that ocr.service will use.
    const { OcrWorkerPool: FreshOcrWorkerPool } = await import('./services/ocr-worker-pool.js');
    const closeSpy = vi.spyOn(FreshOcrWorkerPool.prototype, 'close');
    const ocr = await import('./services/ocr.service.js');

    await ocr.closeDefaultOcrPool();
    expect(closeSpy).not.toHaveBeenCalled();

    const pool = ocr.getDefaultOcrPool();
    await ocr.closeDefaultOcrPool();
    expect(closeSpy).toHaveBeenCalledOnce();
    expect(ocr.getDefaultOcrPool()).toBe(pool); // closed pool stays: stragglers get 503
  });
});

describe('server.ts wiring', () => {
  it('SIGTERM on the real server entry point runs the graceful shutdown and exits 0', async () => {
    const uploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tazascan-shutdown-'));
    // PORT must be positive (env schema), so reserve a free one first.
    const freePort = await new Promise<number>((resolve) => {
      const probe = http.createServer().listen(0, () => {
        const address = probe.address();
        probe.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
      });
    });
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('PORT', String(freePort));
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@127.0.0.1:1/tazascan_shutdown');
    vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-9f2c7a1e4b8d6035-not-real');
    vi.stubEnv('UPLOAD_ROOT', uploadRoot);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const before = { SIGINT: process.listeners('SIGINT'), SIGTERM: process.listeners('SIGTERM') };

    try {
      await import('./server.js');
      await vi.waitFor(() => expect(process.listenerCount('SIGTERM')).toBe(before.SIGTERM.length + 1), {
        timeout: 5_000
      });
      expect(loggedEvents(infoSpy).map((event) => event.event)).toContain('startup');

      process.emit('SIGTERM');
      await vi.waitFor(() => expect(exitSpy).toHaveBeenCalled(), { timeout: 5_000 });

      expect(exitSpy).toHaveBeenCalledExactlyOnceWith(0);
      expect(loggedEvents(infoSpy).map((event) => event.event)).toEqual(
        expect.arrayContaining(['startup', 'shutdown', 'shutdown_complete'])
      );
      expect(loggedEvents(infoSpy).find((event) => event.event === 'shutdown_complete')).toMatchObject({
        failedSteps: []
      });
    } finally {
      for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        for (const listener of process.listeners(signal)) {
          if (!before[signal].includes(listener)) process.off(signal, listener);
        }
      }
      vi.unstubAllEnvs();
      await fs.rm(uploadRoot, { recursive: true, force: true });
    }
  });
});
