import { describe, expect, it } from 'vitest';
import { HalalCheckEngine } from './halal-check.engine';
import type { HalalCheckInput } from './types';

const engine = new HalalCheckEngine();

function input(overrides: Partial<HalalCheckInput>): HalalCheckInput {
  return {
    ingredients: ['water', 'sugar'],
    ingredientsTextOriginal: null,
    ingredientsTextOriginalLanguage: null,
    ingredientsTextRu: null,
    ingredientsTextTranslatedRu: null,
    certifications: [],
    ...overrides
  };
}

describe('HalalCheckEngine', () => {
  it('classifies explicit pork as non-halal', () => {
    const result = engine.calculate(input({ ingredients: ['water', 'pork'] }));

    expect(result.status).toBe('non_halal');
    expect(result.ingredientScreening.status).toBe('non_halal_detected');
    expect(result.reasons).toContain('PORK_DETECTED');
  });

  it('classifies pork fat as non-halal', () => {
    const result = engine.calculate(input({ ingredients: ['water', 'lard'] }));

    expect(result.status).toBe('non_halal');
    expect(result.reasons).toContain('PORK_FAT_DETECTED');
  });

  it('classifies porcine gelatin as non-halal', () => {
    const result = engine.calculate(
      input({ ingredients: ['sugar', 'porcine gelatin'] })
    );

    expect(result.status).toBe('non_halal');
    expect(result.reasons).toContain('PORCINE_GELATIN_DETECTED');
  });

  it('requires review for generic gelatin with unknown source', () => {
    const result = engine.calculate(input({ ingredients: ['sugar', 'gelatin'] }));

    expect(result.status).toBe('review_required');
    expect(result.ingredientScreening.status).toBe('review_required');
    expect(result.reasons).toContain('GELATIN_SOURCE_UNKNOWN');
  });

  it('does not flag explicit fish gelatin as unknown generic gelatin', () => {
    const result = engine.calculate(input({ ingredients: ['fish gelatin'] }));

    expect(result.status).toBe('screening_clear');
    expect(result.ingredientScreening.status).toBe('clear');
    expect(result.reasons).toEqual(['NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED']);
  });

  it('requires review for bovine gelatin unless certification resolves source uncertainty', () => {
    const result = engine.calculate(input({ ingredients: ['bovine gelatin'] }));

    expect(result.status).toBe('review_required');
    expect(result.ingredientScreening.status).toBe('review_required');
    expect(result.reasons).toContain('GELATIN_SOURCE_UNKNOWN');
  });

  it('requires review for E120 and carmine aliases', () => {
    const byCode = engine.calculate(input({ ingredients: ['colour E-120'] }));
    const byAlias = engine.calculate(input({ ingredients: ['carmine'] }));

    expect(byCode.status).toBe('review_required');
    expect(byCode.reasons).toContain('CARMINE_E120_DETECTED');
    expect(byAlias.reasons).toContain('CARMINE_E120_DETECTED');
  });

  it('classifies explicit ethanol ingredient as non-halal', () => {
    const result = engine.calculate(input({ ingredients: ['water', 'ethanol'] }));

    expect(result.status).toBe('non_halal');
    expect(result.reasons).toContain('ALCOHOL_DETECTED');
  });

  it('does not treat sugar, fatty, or benzyl alcohols as explicit ethanol', () => {
    const sugarAlcohol = engine.calculate(input({ ingredients: ['sugar alcohols'] }));
    const fattyAlcohol = engine.calculate(input({ ingredients: ['fatty alcohols'] }));
    const benzylAlcohol = engine.calculate(input({ ingredients: ['benzyl alcohol'] }));

    expect(sugarAlcohol.status).toBe('screening_clear');
    expect(fattyAlcohol.status).toBe('screening_clear');
    expect(benzylAlcohol.status).toBe('screening_clear');
  });

  it('does not flag generic flavouring automatically', () => {
    const result = engine.calculate(input({ ingredients: ['natural flavouring'] }));

    expect(result.status).toBe('screening_clear');
    expect(result.ingredientScreening.status).toBe('clear');
    expect(result.reasons).toEqual(['NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED']);
  });

  it('requires review for alcohol-based flavouring', () => {
    const result = engine.calculate(
      input({ ingredients: ['alcohol-based flavouring'] })
    );

    expect(result.status).toBe('review_required');
    expect(result.reasons).toContain('ALCOHOL_BASED_FLAVOURING_DETECTED');
  });

  it('requires review for animal rennet with unknown source', () => {
    const result = engine.calculate(input({ ingredients: ['rennet'] }));

    expect(result.status).toBe('review_required');
    expect(result.reasons).toContain('ANIMAL_RENNET_SOURCE_UNKNOWN');
  });

  it('does not flag microbial rennet', () => {
    const result = engine.calculate(input({ ingredients: ['microbial rennet'] }));

    expect(result.status).toBe('screening_clear');
    expect(result.ingredientScreening.status).toBe('clear');
    expect(result.reasons).toEqual(['NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED']);
  });

  it('requires review for E471 when the source is unknown', () => {
    const result = engine.calculate(input({ ingredients: ['emulsifier E 471'] }));

    expect(result.status).toBe('review_required');
    expect(result.reasons).toContain('E471_SOURCE_UNKNOWN');
  });

  it('requires review for E472 variants when the source is unknown', () => {
    const result = engine.calculate(input({ ingredients: ['emulsifier E472e'] }));

    expect(result.status).toBe('review_required');
    expect(result.reasons).toContain('E472_SOURCE_UNKNOWN');
  });

  it('does not flag plant-source mono- and diglycerides as unknown source', () => {
    const result = engine.calculate(
      input({ ingredients: ['plant mono- and diglycerides'] })
    );

    expect(result.status).toBe('screening_clear');
    expect(result.ingredientScreening.status).toBe('clear');
    expect(result.reasons).toEqual(['NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED']);
  });

  it('does not flag vegetable-source E471 as unknown source', () => {
    const result = engine.calculate(
      input({ ingredients: ['emulsifier E471 from vegetable source'] })
    );

    expect(result.status).toBe('screening_clear');
    expect(result.ingredientScreening.status).toBe('clear');
  });

  it('requires review for animal fat with unknown species', () => {
    const result = engine.calculate(input({ ingredients: ['animal fat'] }));

    expect(result.status).toBe('review_required');
    expect(result.reasons).toContain('ANIMAL_FAT_SOURCE_UNKNOWN');
  });

  it('requires review for animal shortening with unknown species', () => {
    const result = engine.calculate(input({ ingredients: ['animal shortening'] }));

    expect(result.status).toBe('review_required');
    expect(result.reasons).toContain('ANIMAL_FAT_SOURCE_UNKNOWN');
  });

  it('classifies blood-derived ingredients as non-halal', () => {
    const result = engine.calculate(input({ ingredients: ['blood plasma'] }));

    expect(result.status).toBe('non_halal');
    expect(result.ingredientScreening.status).toBe('non_halal_detected');
    expect(result.reasons).toContain('BLOOD_DETECTED');
  });

  it('classifies explicit pork animal fat as non-halal', () => {
    const result = engine.calculate(input({ ingredients: ['pork fat'] }));

    expect(result.status).toBe('non_halal');
    expect(result.reasons).toContain('PORK_FAT_DETECTED');
  });

  it('returns insufficient data when ingredients are missing', () => {
    const result = engine.calculate(input({ ingredients: [] }));

    expect(result.status).toBe('insufficient_data');
    expect(result.ingredientScreening.status).toBe('insufficient_data');
    expect(result.reasons).toEqual(['INGREDIENTS_MISSING']);
  });

  it('does not classify a clean ingredient list as halal without certification', () => {
    const result = engine.calculate(input({ ingredients: ['water', 'sugar'] }));

    expect(result.status).toBe('screening_clear');
    expect(result.ingredientScreening.status).toBe('clear');
    expect(result.certification.status).toBe('not_verified');
    expect(result.reasons).toEqual(['NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED']);
  });

  it('confirms halal only with verified certification and no explicit conflict', () => {
    const result = engine.calculate(
      input({
        certifications: [
          {
            status: 'verified',
            issuer: 'Trusted halal body',
            source: 'admin_verified_document'
          }
        ]
      })
    );

    expect(result.status).toBe('halal_confirmed');
    expect(result.ingredientScreening.status).toBe('clear');
    expect(result.certification.status).toBe('verified');
    expect(result.reasons).toContain('CERTIFICATION_VERIFIED');
  });

  it('allows verified certification to resolve ambiguous source-dependent ingredients', () => {
    const result = engine.calculate(
      input({
        ingredients: ['gelatin'],
        certifications: [
          {
            status: 'verified',
            issuer: 'Trusted halal body',
            source: 'admin_verified_document'
          }
        ]
      })
    );

    expect(result.status).toBe('halal_confirmed');
    expect(result.ingredientScreening.status).toBe('review_required');
    expect(result.certification.status).toBe('verified');
    expect(result.reasons).toContain('GELATIN_SOURCE_UNKNOWN');
    expect(result.reasons).toContain('CERTIFICATION_VERIFIED');
  });

  it('confirms halal from verified certification even when ingredients are missing', () => {
    const result = engine.calculate(
      input({
        ingredients: [],
        certifications: [
          {
            status: 'verified',
            issuer: 'Trusted halal body',
            source: 'admin_verified_document'
          }
        ]
      })
    );

    expect(result.status).toBe('halal_confirmed');
    expect(result.ingredientScreening.status).toBe('insufficient_data');
    expect(result.reasons).toContain('INGREDIENTS_MISSING');
    expect(result.reasons).toContain('CERTIFICATION_VERIFIED');
  });

  it('requires review for verified certification with explicit pork conflict', () => {
    const result = engine.calculate(
      input({
        ingredients: ['pork gelatin'],
        certifications: [
          {
            status: 'verified',
            issuer: 'Trusted halal body',
            source: 'admin_verified_document'
          }
        ]
      })
    );

    expect(result.status).toBe('review_required');
    expect(result.ingredientScreening.status).toBe('non_halal_detected');
    expect(result.reasons).toContain('CERTIFICATION_CONFLICT');
    expect(result.certification.status).toBe('conflict');
  });

  it('requires review for unverified and expired certification records', () => {
    const unverified = engine.calculate(
      input({
        certifications: [{ status: 'unverified', issuer: 'Logo text' }]
      })
    );
    const expired = engine.calculate(
      input({
        certifications: [{ status: 'expired', issuer: 'Expired issuer' }]
      })
    );

    expect(unverified.status).toBe('review_required');
    expect(unverified.ingredientScreening.status).toBe('clear');
    expect(unverified.certification.status).toBe('not_verified');
    expect(unverified.reasons).toContain('CERTIFICATION_UNVERIFIED');
    expect(expired.reasons).toContain('CERTIFICATION_EXPIRED');
    expect(expired.certification.status).toBe('expired');
  });

  it('keeps Halal Check result non-numeric and separate from nutrition scoring', () => {
    const result = engine.calculate(input({ ingredients: ['pork'] }));

    expect(result.status).toBe('non_halal');
    expect(result).not.toHaveProperty('score');
    expect(result).not.toHaveProperty('nutritionComponent');
    expect(result).not.toHaveProperty('calculatedScore');
  });

  it('uses word-boundary-aware matching and avoids false positives', () => {
    const result = engine.calculate(input({ ingredients: ['rumex extract'] }));

    expect(result.status).toBe('screening_clear');
    expect(result.reasons).toEqual(['NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED']);
  });

  it('does not match E120 inside E1200 or E471 inside E4710', () => {
    const result = engine.calculate(
      input({ ingredients: ['emulsifier E1200', 'stabilizer E4710'] })
    );

    expect(result.status).toBe('screening_clear');
    expect(result.reasons).toEqual(['NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED']);
  });

  it('does not match pork inside unrelated words', () => {
    const result = engine.calculate(input({ ingredients: ['spork-shaped candy'] }));

    expect(result.status).toBe('screening_clear');
    expect(result.reasons).toEqual(['NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED']);
  });

  it('does not let generated translation override original source text', () => {
    const result = engine.calculate(
      input({
        ingredients: [],
        ingredientsTextOriginal: 'water; sugar',
        ingredientsTextTranslatedRu: 'свинина'
      })
    );

    expect(result.status).toBe('screening_clear');
    expect(result.ingredientScreening.status).toBe('clear');
    expect(result.reasons).toEqual(['NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED']);
    expect(result.dataCoverage.generatedTranslationUsedOnlyAsAssistance).toBe(true);
  });

  it('returns methodology v1.2 for expanded rule coverage and certification semantics', () => {
    const result = engine.calculate(input({ ingredients: ['water', 'sugar'] }));

    expect(result.methodology).toBe('halal-check-v1.2');
    expect(result.status).not.toBe('halal_confirmed');
    expect(result.ingredientScreening.status).toBe('clear');
    expect(result.certification.status).toBe('not_verified');
  });
});
