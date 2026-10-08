import { HttpError } from '../utils/http-error';

/** Minimal surface of a Tesseract worker used by the pool. */
export type OcrWorker = {
  recognize(image: Buffer): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
};

export type OcrWorkerFactory = () => Promise<OcrWorker>;

export type OcrWorkerPoolOptions = {
  createWorker: OcrWorkerFactory;
  /** Number of Tesseract workers (threads) allowed to run at once. */
  size?: number;
  /** Jobs allowed to wait for a free worker; further jobs fail fast with 503. */
  maxQueue?: number;
  /** Max time a job may wait in the queue before failing with 503. */
  queueTimeoutMs?: number;
  /** Max time for worker start-up + recognition; the worker is terminated on expiry. */
  jobTimeoutMs?: number;
};

type Slot = {
  worker: OcrWorker | null;
  /** Worker start-up in progress (thread spawned, language data loading). */
  starting: Promise<OcrWorker> | null;
  busy: boolean;
};

type QueuedJob = {
  image: Buffer;
  resolve: (text: string) => void;
  reject: (error: HttpError) => void;
  queueTimer: NodeJS.Timeout;
};

export const ocrBusyMessage = 'OCR service is busy. Try again later.';

/**
 * Fixed-size pool of long-lived OCR workers with a bounded FIFO queue.
 *
 * A timed-out or failed job terminates its worker thread (stopping its CPU work), and the
 * slot stays occupied until termination completes, so no more than `size` OCR threads run.
 */
export class OcrWorkerPool {
  private readonly createWorker: OcrWorkerFactory;
  private readonly maxQueue: number;
  private readonly queueTimeoutMs: number;
  private readonly jobTimeoutMs: number;
  private readonly slots: Slot[];
  private readonly queue: QueuedJob[] = [];
  private closed = false;

  constructor(options: OcrWorkerPoolOptions) {
    this.createWorker = options.createWorker;
    this.maxQueue = options.maxQueue ?? 4;
    this.queueTimeoutMs = options.queueTimeoutMs ?? 10_000;
    this.jobTimeoutMs = options.jobTimeoutMs ?? 20_000;
    this.slots = Array.from({ length: options.size ?? 1 }, () => ({ worker: null, starting: null, busy: false }));
  }

  get activeCount() {
    return this.slots.filter((slot) => slot.busy).length;
  }

  get queuedCount() {
    return this.queue.length;
  }

  recognize(image: Buffer): Promise<string> {
    if (this.closed) {
      return Promise.reject(new HttpError(503, ocrBusyMessage));
    }

    const freeSlot = this.slots.find((slot) => !slot.busy);
    if (freeSlot) {
      return new Promise((resolve, reject) => this.runJob(freeSlot, image, resolve, reject));
    }

    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(new HttpError(503, ocrBusyMessage));
    }

    return new Promise((resolve, reject) => {
      const job: QueuedJob = {
        image,
        resolve,
        reject,
        queueTimer: setTimeout(() => {
          const index = this.queue.indexOf(job);
          if (index !== -1) {
            this.queue.splice(index, 1);
            reject(new HttpError(503, ocrBusyMessage));
          }
        }, this.queueTimeoutMs)
      };
      this.queue.push(job);
    });
  }

  /** Terminates all workers and rejects queued jobs (shutdown / tests). */
  async close() {
    this.closed = true;
    for (const job of this.queue.splice(0)) {
      clearTimeout(job.queueTimer);
      job.reject(new HttpError(503, ocrBusyMessage));
    }
    await Promise.all(this.slots.map((slot) => this.discardWorker(slot)));
  }

  private runJob(
    slot: Slot,
    image: Buffer,
    resolve: (text: string) => void,
    reject: (error: HttpError) => void
  ) {
    slot.busy = true;
    let settled = false;

    const finish = async (outcome: { text: string } | { error: HttpError; discard: boolean }) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(jobTimer);

      if ('text' in outcome) {
        resolve(outcome.text);
      } else {
        reject(outcome.error);
        if (outcome.discard) {
          // Stop the thread before the slot is reused, so timed-out work never overlaps.
          await this.discardWorker(slot);
        }
      }

      slot.busy = false;
      this.drainQueue();
    };

    const jobTimer = setTimeout(() => {
      void finish({ error: new HttpError(504, 'OCR timed out'), discard: true });
    }, this.jobTimeoutMs);

    void (async () => {
      try {
        if (!slot.worker) {
          slot.starting = this.createWorker();
          const worker = await slot.starting;
          slot.starting = null;
          if (settled) {
            // Timed out (or closed) while starting: discardWorker terminates it.
            return;
          }
          slot.worker = worker;
        }

        const result = await slot.worker.recognize(image);
        await finish({ text: result.data.text });
      } catch {
        await finish({ error: new HttpError(422, 'OCR failed'), discard: true });
      }
    })();
  }

  private drainQueue() {
    if (this.closed) {
      return;
    }

    for (const slot of this.slots) {
      if (slot.busy) {
        continue;
      }

      const job = this.queue.shift();
      if (!job) {
        return;
      }

      clearTimeout(job.queueTimer);
      this.runJob(slot, job.image, job.resolve, job.reject);
    }
  }

  private async discardWorker(slot: Slot) {
    const worker = slot.worker;
    const starting = slot.starting;
    slot.worker = null;
    slot.starting = null;

    if (worker) {
      await worker.terminate().catch(() => undefined);
    }

    if (starting) {
      // Wait (bounded) for a worker that is still starting so its thread is stopped before
      // the slot is reused; if start-up hangs, terminate it whenever it finally resolves.
      const terminateStarted = starting.then(
        (started) => started.terminate().catch(() => undefined),
        () => undefined
      );
      await Promise.race([terminateStarted, delay(this.jobTimeoutMs)]);
    }
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}
