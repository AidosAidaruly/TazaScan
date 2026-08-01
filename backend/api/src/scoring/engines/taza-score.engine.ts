import type { ScoreEngine } from '../contracts/score-engine';
import type { ScoreInput, ScoreResult } from '../types/score-result';

export class TazaScoreEngine implements ScoreEngine {
  calculate(_input: ScoreInput): ScoreResult {
    throw new Error('TazaScoreEngine is not implemented yet.');
  }
}
