import type { ScoreInput, ScoreResult } from '../types/score-result';

export interface ScoreEngine {
  calculate(input: ScoreInput): ScoreResult;
}
