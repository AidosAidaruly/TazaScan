import { createWorker } from 'tesseract.js';
import { HttpError } from '../utils/http-error';
import { OcrWorkerPool } from './ocr-worker-pool';

const ocrLanguages = 'eng+rus';
// OEM 1 (LSTM only) matches tesseract.js's recognize() helper used previously.
const ocrEngineMode = 1;

let defaultPool: OcrWorkerPool | null = null;

/** Process-wide pool shared by every OcrService instance (photo search + submission OCR). */
export function getDefaultOcrPool() {
  defaultPool ??= new OcrWorkerPool({
    createWorker: () => createWorker(ocrLanguages, ocrEngineMode),
    size: 1,
    maxQueue: 4,
    queueTimeoutMs: 10_000,
    jobTimeoutMs: 20_000
  });

  return defaultPool;
}

/**
 * Releases the shared pool's workers at shutdown. Does not create a pool that was never
 * used; the closed pool stays in place so any straggler gets a clean 503.
 */
export async function closeDefaultOcrPool() {
  await defaultPool?.close();
}

type OcrPoolContract = Pick<OcrWorkerPool, 'recognize'>;

export class OcrService {
  constructor(private readonly pool: OcrPoolContract = getDefaultOcrPool()) {}

  async extractText(imageBuffer: Buffer): Promise<string> {
    try {
      const text = await this.pool.recognize(imageBuffer);
      return text.trim();
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(422, 'OCR failed');
    }
  }
}
