import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../middleware/error-handler';
import { HttpError } from '../utils/http-error';
import { ocrBusyMessage, OcrWorkerPool, type OcrWorker } from './ocr-worker-pool';
import { OcrService } from './ocr.service';

type Behavior = (image: Buffer) => Promise<string>;

class FakeWorker implements OcrWorker {
  terminated = false;
  running = 0;
  recognized: string[] = [];

  constructor(private readonly behavior: Behavior) {}

  /** A real worker thread stops consuming CPU once terminated. */
  get isConsumingCpu() {
    return this.running > 0 && !this.terminated;
  }

  async recognize(image: Buffer) {
    if (this.terminated) {
      throw new Error('worker terminated');
    }

    this.running += 1;
    try {
      const text = await this.behavior(image);
      this.recognized.push(image.toString());
      return { data: { text } };
    } finally {
      this.running -= 1;
    }
  }

  async terminate() {
    this.terminated = true;
  }
}

function deferred<T = string>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const never = () => new Promise<string>(() => undefined);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const pools: OcrWorkerPool[] = [];

function createPool(
  behavior: Behavior,
  options: Partial<{ size: number; maxQueue: number; queueTimeoutMs: number; jobTimeoutMs: number }> = {},
  startWorker?: () => Promise<void>
) {
  const workers: FakeWorker[] = [];
  const pool = new OcrWorkerPool({
    size: 1,
    maxQueue: 4,
    queueTimeoutMs: 1_000,
    jobTimeoutMs: 1_000,
    ...options,
    createWorker: async () => {
      await startWorker?.();
      const worker = new FakeWorker(behavior);
      workers.push(worker);
      return worker;
    }
  });
  pools.push(pool);

  const liveWorkers = () => workers.filter((worker) => !worker.terminated).length;
  const worker = (index: number) => {
    const found = workers[index];
    if (!found) {
      throw new Error(`worker ${index} was not created`);
    }
    return found;
  };

  return { pool, workers, worker, liveWorkers };
}

afterEach(async () => {
  await Promise.all(pools.splice(0).map((pool) => pool.close()));
});

describe('OcrWorkerPool', () => {
  it('returns trimmed OCR text through OcrService and reuses the worker', async () => {
    const { pool, workers } = createPool(async (image) => `  ${image.toString()} text \n`);
    const service = new OcrService(pool);

    await expect(service.extractText(Buffer.from('first'))).resolves.toBe('first text');
    await expect(service.extractText(Buffer.from('second'))).resolves.toBe('second text');
    expect(workers).toHaveLength(1);
    expect(pool.activeCount).toBe(0);
  });

  it('never runs more jobs at once than the pool size', async () => {
    const gate = deferred();
    let concurrent = 0;
    let maxConcurrent = 0;
    const { pool } = createPool(
      async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await gate.promise;
        concurrent -= 1;
        return 'ok';
      },
      { size: 2, maxQueue: 4 }
    );

    const jobs = Array.from({ length: 5 }, (_, index) => pool.recognize(Buffer.from(`job${index}`)));
    await sleep(10);

    expect(pool.activeCount).toBe(2);
    expect(pool.queuedCount).toBe(3);
    expect(maxConcurrent).toBe(2);

    gate.resolve('ok');
    await expect(Promise.all(jobs)).resolves.toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    expect(maxConcurrent).toBe(2);
  });

  it('makes queued jobs wait for a free worker and runs them in order', async () => {
    const first = deferred();
    const { pool, worker } = createPool((image) =>
      image.toString() === 'A' ? first.promise : Promise.resolve(image.toString())
    );

    const jobA = pool.recognize(Buffer.from('A'));
    const jobB = pool.recognize(Buffer.from('B'));
    const jobC = pool.recognize(Buffer.from('C'));
    await sleep(10);

    expect(pool.queuedCount).toBe(2);
    expect(worker(0).recognized).toEqual([]);

    first.resolve('A');
    await expect(Promise.all([jobA, jobB, jobC])).resolves.toEqual(['A', 'B', 'C']);
    expect(worker(0).recognized).toEqual(['A', 'B', 'C']);
  });

  it('fails fast with 503 when the queue is full', async () => {
    const gate = deferred();
    const { pool } = createPool(() => gate.promise, { size: 1, maxQueue: 1 });

    const running = pool.recognize(Buffer.from('running'));
    const queued = pool.recognize(Buffer.from('queued'));
    await sleep(5);

    await expect(pool.recognize(Buffer.from('overflow'))).rejects.toMatchObject({
      statusCode: 503,
      message: ocrBusyMessage
    });

    gate.resolve('done');
    await expect(Promise.all([running, queued])).resolves.toEqual(['done', 'done']);
  });

  it('drops a job that waited too long in the queue with 503 without running it', async () => {
    const gate = deferred();
    const { pool, worker } = createPool(
      (image) => (image.toString() === 'slow' ? gate.promise : Promise.resolve('late')),
      { queueTimeoutMs: 30 }
    );

    const slow = pool.recognize(Buffer.from('slow'));
    await expect(pool.recognize(Buffer.from('waiting'))).rejects.toMatchObject({
      statusCode: 503,
      message: ocrBusyMessage
    });
    expect(pool.queuedCount).toBe(0);

    gate.resolve('slow');
    await expect(slow).resolves.toBe('slow');
    expect(worker(0).recognized).toEqual(['slow']);
  });

  it('terminates the worker on timeout so no OCR work keeps running', async () => {
    const { pool, worker, liveWorkers } = createPool(never, { jobTimeoutMs: 30 });

    await expect(pool.recognize(Buffer.from('stuck'))).rejects.toMatchObject({
      statusCode: 504,
      message: 'OCR timed out'
    });

    expect(worker(0).terminated).toBe(true);
    expect(worker(0).isConsumingCpu).toBe(false);
    expect(liveWorkers()).toBe(0);
    expect(pool.activeCount).toBe(0);
  });

  it('serves the next request with a fresh worker after a timeout', async () => {
    let calls = 0;
    const { pool, workers, worker } = createPool(
      () => {
        calls += 1;
        return calls === 1 ? never() : Promise.resolve('recovered');
      },
      { jobTimeoutMs: 30 }
    );

    await expect(pool.recognize(Buffer.from('stuck'))).rejects.toMatchObject({ statusCode: 504 });
    await expect(pool.recognize(Buffer.from('next'))).resolves.toBe('recovered');

    expect(workers).toHaveLength(2);
    expect(worker(0).terminated).toBe(true);
    expect(worker(1).terminated).toBe(false);
  });

  it('starts a queued job only after the timed-out worker is terminated', async () => {
    let calls = 0;
    let maxLive = 0;
    const { pool, worker, liveWorkers } = createPool(
      () => {
        calls += 1;
        maxLive = Math.max(maxLive, liveWorkers());
        return calls === 1 ? never() : Promise.resolve('queued ok');
      },
      { jobTimeoutMs: 30 }
    );

    const stuck = pool.recognize(Buffer.from('stuck'));
    const queued = pool.recognize(Buffer.from('queued'));

    await expect(stuck).rejects.toMatchObject({ statusCode: 504 });
    await expect(queued).resolves.toBe('queued ok');
    expect(worker(0).terminated).toBe(true);
    expect(maxLive).toBe(1);
  });

  it('terminates a worker that finishes starting after its job timed out', async () => {
    const { pool, workers, worker, liveWorkers } = createPool(
      async () => 'ok',
      { jobTimeoutMs: 20 },
      () => sleep(60)
    );

    await expect(pool.recognize(Buffer.from('slow start'))).rejects.toMatchObject({
      statusCode: 504
    });
    // The client gets 504 immediately; the slot stays occupied until the late worker is
    // terminated, so no replacement can start alongside it.
    expect(pool.activeCount).toBe(1);
    await vi.waitFor(() => expect(pool.activeCount).toBe(0), { timeout: 1_000 });

    expect(workers).toHaveLength(1);
    expect(worker(0).terminated).toBe(true);
    expect(liveWorkers()).toBe(0);
  });

  it('replaces the worker after a recognition failure', async () => {
    let calls = 0;
    const { pool, workers, worker } = createPool(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('tesseract internal failure: corrupted state');
      }
      return 'fine';
    });

    await expect(pool.recognize(Buffer.from('bad'))).rejects.toMatchObject({
      statusCode: 422,
      message: 'OCR failed'
    });
    expect(worker(0).terminated).toBe(true);

    await expect(pool.recognize(Buffer.from('good'))).resolves.toBe('fine');
    expect(workers).toHaveLength(2);
  });

  it('recovers when a worker fails to start', async () => {
    let starts = 0;
    const { pool } = createPool(
      async () => 'started',
      {},
      async () => {
        starts += 1;
        if (starts === 1) {
          throw new Error('failed to load traineddata');
        }
      }
    );

    await expect(pool.recognize(Buffer.from('first'))).rejects.toMatchObject({ statusCode: 422 });
    await expect(pool.recognize(Buffer.from('second'))).resolves.toBe('started');
  });

  it('close() rejects queued jobs and terminates workers', async () => {
    const gate = deferred();
    const { pool, worker } = createPool(() => gate.promise);

    void pool.recognize(Buffer.from('running')).catch(() => undefined);
    const queued = pool.recognize(Buffer.from('queued'));
    await sleep(5);

    await pool.close();

    await expect(queued).rejects.toMatchObject({ statusCode: 503 });
    expect(worker(0).terminated).toBe(true);
    await expect(pool.recognize(Buffer.from('after close'))).rejects.toMatchObject({
      statusCode: 503
    });
  });
});

describe('OCR HTTP status behavior', () => {
  function createOcrApp(service: OcrService) {
    const app = express();
    app.post('/ocr', async (_request, response, next) => {
      try {
        const text = await service.extractText(Buffer.from('image'));
        response.status(200).json({ data: { text } });
      } catch (error) {
        next(error);
      }
    });
    app.use(errorHandler);

    return app;
  }

  it('returns 503 with a clean message when OCR is saturated', async () => {
    const gate = deferred();
    const { pool } = createPool(() => gate.promise, { size: 1, maxQueue: 0 });
    const app = createOcrApp(new OcrService(pool));

    const busy = request(app).post('/ocr').then((response) => response);
    await sleep(20);
    const rejected = await request(app).post('/ocr');

    expect(rejected.status).toBe(503);
    expect(rejected.body.error).toEqual({ message: ocrBusyMessage });

    gate.resolve('done');
    expect((await busy).status).toBe(200);
  });

  it('returns 504 on timeout and 422 on failure without internal Tesseract details', async () => {
    const timedOut = await request(
      createOcrApp(new OcrService(createPool(never, { jobTimeoutMs: 20 }).pool))
    ).post('/ocr');
    expect(timedOut.status).toBe(504);
    expect(timedOut.body.error).toEqual({ message: 'OCR timed out' });

    const failed = await request(
      createOcrApp(
        new OcrService(
          createPool(async () => {
            throw new Error('Error: tesseract-core abort at 0xdeadbeef');
          }).pool
        )
      )
    ).post('/ocr');
    expect(failed.status).toBe(422);
    expect(failed.body.error).toEqual({ message: 'OCR failed' });
    expect(JSON.stringify(failed.body)).not.toMatch(/tesseract|deadbeef/i);
  });

  it('maps unexpected non-HttpError pool failures to 422', async () => {
    const service = new OcrService({
      recognize: () => Promise.reject(new Error('unexpected'))
    });

    await expect(service.extractText(Buffer.from('x'))).rejects.toEqual(
      new HttpError(422, 'OCR failed')
    );
  });
});
