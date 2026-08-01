import { recognize } from 'tesseract.js';
import { HttpError } from '../utils/http-error';

const ocrTimeoutMs = 20000;

export class OcrService {
  async extractText(imageBuffer: Buffer): Promise<string> {
    try {
      const result = await this.withTimeout(
        recognize(imageBuffer, 'eng'),
        ocrTimeoutMs
      );

      return result.data.text.trim();
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(422, 'OCR failed');
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new HttpError(504, 'OCR timed out'));
      }, timeoutMs);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeout));
    });
  }
}
