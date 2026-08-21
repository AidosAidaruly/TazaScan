import type {
  SubmissionIngredientsOcrCandidate,
  SubmissionNutritionOcrCandidate
} from '../types/submission-ocr';
import { SubmissionOcrParser } from './submission-ocr.parser';

type OcrServiceContract = {
  extractText(imageBuffer: Buffer): Promise<string>;
};

export class SubmissionOcrService {
  constructor(
    private readonly ocrService: OcrServiceContract,
    private readonly parser = new SubmissionOcrParser()
  ) {}

  async recognizeNutrition(imageBuffer: Buffer): Promise<SubmissionNutritionOcrCandidate> {
    const rawText = await this.ocrService.extractText(imageBuffer);
    return this.parser.parseNutrition(rawText);
  }

  async recognizeIngredients(imageBuffer: Buffer): Promise<SubmissionIngredientsOcrCandidate> {
    const rawText = await this.ocrService.extractText(imageBuffer);
    return this.parser.parseIngredients(rawText);
  }
}
