import { halalIngredientRules } from './halal-ingredient-rules';
import type {
  HalalCertificationInput,
  HalalCheckInput,
  HalalCheckResult,
  HalalIngredientScreeningStatus,
  HalalIngredientRule,
  HalalIngredientSource,
  HalalMatchedSignal,
  HalalReasonCode
} from './types';

export class HalalCheckEngine {
  calculate(input: HalalCheckInput): HalalCheckResult {
    const sources = this.buildSources(input);
    const authoritativeSources = sources.filter((source) => source.authoritative);
    const analysisSources =
      authoritativeSources.length > 0
        ? authoritativeSources
        : sources.filter((source) => source.kind === 'generated_translation');
    const certifications = input.certifications ?? [];
    const verifiedCertification = certifications.find(
      (certification) => certification.status === 'verified'
    );
    const unverifiedCertification = certifications.find(
      (certification) => certification.status === 'unverified'
    );
    const expiredCertification = certifications.find(
      (certification) => certification.status === 'expired'
    );

    if (analysisSources.length === 0) {
      if (verifiedCertification) {
        return this.result({
          status: 'halal_confirmed',
          ingredientScreeningStatus: 'insufficient_data',
          reasons: uniqueReasons(['INGREDIENTS_MISSING', 'CERTIFICATION_VERIFIED']),
          matchedSignals: [],
          certifications,
          authoritativeIngredientSource: false,
          generatedTranslationUsedOnlyAsAssistance: false
        });
      }

      return this.result({
        status: 'insufficient_data',
        ingredientScreeningStatus: 'insufficient_data',
        reasons: ['INGREDIENTS_MISSING'],
        matchedSignals: [],
        certifications,
        authoritativeIngredientSource: false,
        generatedTranslationUsedOnlyAsAssistance: false
      });
    }

    const matchedSignals = this.matchRules(analysisSources);
    const hasNonHalal = matchedSignals.some((signal) => signal.severity === 'non_halal');
    const hasReview = matchedSignals.some((signal) => signal.severity === 'review_required');
    const reasons = uniqueReasons(matchedSignals.map((signal) => signal.reasonCode));

    if (verifiedCertification && hasNonHalal) {
      return this.result({
        status: 'review_required',
        ingredientScreeningStatus: 'non_halal_detected',
        reasons: uniqueReasons([...reasons, 'CERTIFICATION_VERIFIED', 'CERTIFICATION_CONFLICT']),
        matchedSignals,
        certifications,
        certificationStatus: 'conflict',
        authoritativeIngredientSource: authoritativeSources.length > 0,
        generatedTranslationUsedOnlyAsAssistance: this.hasGeneratedTranslation(input)
      });
    }

    if (hasNonHalal) {
      return this.result({
        status: 'non_halal',
        ingredientScreeningStatus: 'non_halal_detected',
        reasons,
        matchedSignals,
        certifications,
        authoritativeIngredientSource: authoritativeSources.length > 0,
        generatedTranslationUsedOnlyAsAssistance: this.hasGeneratedTranslation(input)
      });
    }

    if (verifiedCertification) {
      return this.result({
        status: 'halal_confirmed',
        ingredientScreeningStatus: hasReview ? 'review_required' : 'clear',
        reasons: uniqueReasons([...reasons, 'CERTIFICATION_VERIFIED']),
        matchedSignals,
        certifications,
        authoritativeIngredientSource: authoritativeSources.length > 0,
        generatedTranslationUsedOnlyAsAssistance: this.hasGeneratedTranslation(input)
      });
    }

    if (hasReview || unverifiedCertification || expiredCertification) {
      return this.result({
        status: 'review_required',
        ingredientScreeningStatus: hasReview ? 'review_required' : 'clear',
        reasons: uniqueReasons([
          ...reasons,
          ...(unverifiedCertification ? ['CERTIFICATION_UNVERIFIED' as const] : []),
          ...(expiredCertification ? ['CERTIFICATION_EXPIRED' as const] : [])
        ]),
        matchedSignals,
        certifications,
        authoritativeIngredientSource: authoritativeSources.length > 0,
        generatedTranslationUsedOnlyAsAssistance: this.hasGeneratedTranslation(input)
      });
    }

    return this.result({
      status: 'screening_clear',
      ingredientScreeningStatus: 'clear',
      reasons: ['NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED'],
      matchedSignals,
      certifications,
      authoritativeIngredientSource: authoritativeSources.length > 0,
      generatedTranslationUsedOnlyAsAssistance: this.hasGeneratedTranslation(input)
    });
  }

  private buildSources(input: HalalCheckInput): HalalIngredientSource[] {
    const sources: HalalIngredientSource[] = [];

    this.addSource(sources, 'original', input.ingredientsTextOriginal, true);
    this.addSource(sources, 'source_russian', input.ingredientsTextRu, true);
    if (input.ingredients.length > 0) {
      this.addSource(sources, 'ingredient_list', input.ingredients.join('; '), true);
    }
    this.addSource(sources, 'generated_translation', input.ingredientsTextTranslatedRu, false);

    return sources;
  }

  private addSource(
    sources: HalalIngredientSource[],
    kind: HalalIngredientSource['kind'],
    text: string | null | undefined,
    authoritative: boolean
  ) {
    const trimmed = text?.trim();
    if (trimmed) {
      sources.push({ kind, text: trimmed, authoritative });
    }
  }

  private matchRules(sources: HalalIngredientSource[]) {
    const signals: HalalMatchedSignal[] = [];

    for (const source of sources) {
      const normalizedText = normalizeForHalalMatching(source.text);

      for (const rule of halalIngredientRules) {
        if (this.isExcluded(rule, normalizedText)) {
          continue;
        }

        const matchedAlias = rule.aliases.find((alias) =>
          containsAlias(normalizedText, alias)
        );

        if (!matchedAlias) {
          continue;
        }

        if (
          signals.some(
            (signal) =>
              signal.ruleId === rule.id && signal.sourceKind === source.kind
          )
        ) {
          continue;
        }

        signals.push({
          ruleId: rule.id,
          reasonCode: rule.reasonCode,
          severity: rule.severity,
          matchedText: matchedAlias,
          sourceKind: source.kind
        });
      }
    }

    return signals;
  }

  private isExcluded(rule: HalalIngredientRule, normalizedText: string) {
    return (
      rule.excludedAliases?.some((alias) => containsAlias(normalizedText, alias)) ??
      false
    );
  }

  private hasGeneratedTranslation(input: HalalCheckInput) {
    return Boolean(input.ingredientsTextTranslatedRu?.trim());
  }

  private result({
    status,
    ingredientScreeningStatus,
    reasons,
    matchedSignals,
    certifications,
    certificationStatus,
    authoritativeIngredientSource,
    generatedTranslationUsedOnlyAsAssistance
  }: {
    status: HalalCheckResult['status'];
    ingredientScreeningStatus: HalalIngredientScreeningStatus;
    reasons: HalalReasonCode[];
    matchedSignals: HalalMatchedSignal[];
    certifications: HalalCertificationInput[];
    certificationStatus?: HalalCheckResult['certification']['status'];
    authoritativeIngredientSource: boolean;
    generatedTranslationUsedOnlyAsAssistance: boolean;
  }): HalalCheckResult {
    return {
      status,
      reasons: uniqueReasons(reasons),
      matchedSignals,
      ingredientScreening: {
        status: ingredientScreeningStatus,
        reasons: uniqueReasons(
          reasons.filter((reason) => !reason.startsWith('CERTIFICATION_'))
        ),
        matchedSignals
      },
      certification: {
        status: certificationStatus ?? this.readCertificationStatus(certifications),
        records: certifications.map((certification) => ({
          status: certification.status,
          issuer: certification.issuer,
          certificateNumber: certification.certificateNumber ?? null,
          validUntil: toIsoDate(certification.validUntil),
          source: certification.source ?? null,
          evidenceUrl: certification.evidenceUrl ?? null,
          verifiedAt: toIsoDate(certification.verifiedAt)
        }))
      },
      dataCoverage: {
        ingredientsAvailable: authoritativeIngredientSource || matchedSignals.length > 0,
        authoritativeIngredientSource,
        generatedTranslationUsedOnlyAsAssistance
      },
      methodology: 'halal-check-v1.2'
    };
  }

  private readCertificationStatus(certifications: HalalCertificationInput[]) {
    if (certifications.some((certification) => certification.status === 'verified')) {
      return 'verified';
    }
    if (certifications.some((certification) => certification.status === 'unverified')) {
      return 'not_verified';
    }
    if (certifications.some((certification) => certification.status === 'expired')) {
      return 'expired';
    }
    return 'not_verified';
  }
}

export function normalizeForHalalMatching(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\be[\s-]?(\d{3,4})\b/g, 'e$1')
    .replace(/[()[\]{}.,;:!?/\\_+="'`~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAlias(normalizedText: string, alias: string) {
  const normalizedAlias = normalizeForHalalMatching(alias);
  const escapedAlias = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|\\s)${escapedAlias}(?=\\s|$)`, 'u');

  return pattern.test(normalizedText);
}

function uniqueReasons(reasons: HalalReasonCode[]) {
  return [...new Set(reasons)];
}

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
