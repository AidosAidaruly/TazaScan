import { describe, expect, it } from 'vitest'
import {
  emptyProductFormValues,
  formValuesToPayload,
  productToFormValues,
} from './product-form'
import { isValidBarcode } from './barcode'
import type { HalalCheckDto } from '../types'

const halalCheckFixture: HalalCheckDto = {
  status: 'screening_clear',
  reasons: ['NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED'],
  matchedSignals: [],
  ingredientScreening: {
    status: 'clear',
    reasons: ['NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED'],
    matchedSignals: [],
  },
  certification: {
    status: 'not_verified',
    records: [],
  },
  dataCoverage: {
    ingredientsAvailable: true,
    authoritativeIngredientSource: true,
    generatedTranslationUsedOnlyAsAssistance: false,
  },
  methodology: 'halal-check-v1.2',
}

describe('product form mapping', () => {
  it('sends unknown nutrition values as null', () => {
    const payload = formValuesToPayload({
      ...emptyProductFormValues,
      barcode: '5449000000996',
      name: 'Coca-Cola Original Taste',
      category: 'Soft Drinks',
      sugars: '',
      protein: '0',
    })

    expect(payload.nutritionFacts.sugars).toBeNull()
    expect(payload.nutritionFacts.protein).toBe(0)
    expect('healthScore' in payload).toBe(false)
  })

  it('maps unknown official Nutri-Score fields as null', () => {
    const payload = formValuesToPayload(emptyProductFormValues)

    expect(payload.officialNutriScoreCategory).toBeNull()
    expect(payload.fruitVegetableLegumePercent).toBeNull()
    expect(payload.containsNonSugarSweeteners).toBeNull()
  })

  it('preserves 0 percent and false sweetener flag', () => {
    const payload = formValuesToPayload({
      ...emptyProductFormValues,
      officialNutriScoreCategory: 'beverage',
      fruitVegetableLegumePercent: '0',
      containsNonSugarSweeteners: 'false',
    })

    expect(payload.officialNutriScoreCategory).toBe('beverage')
    expect(payload.fruitVegetableLegumePercent).toBe(0)
    expect(payload.containsNonSugarSweeteners).toBe(false)
  })

  it('maps product official Nutri-Score fields into form values', () => {
    const values = productToFormValues({
      id: 'product-id',
      barcode: '5449000000996',
      name: 'Coca-Cola',
      brand: 'Coca-Cola',
      category: 'Soft Drinks',
      ingredients: [],
      nutritionFacts: {
        servingType: 'per100ml',
        energyKcal: 42,
        protein: 0,
        carbohydrates: 10.6,
        sugars: 10.6,
        fat: 0,
        saturatedFat: 0,
        fiber: null,
        salt: 0,
      },
      healthScore: 65,
      nutritionScore: {
        score: 65,
        grade: 'D',
        status: 'calculated',
        positiveReasons: [],
        negativeReasons: [],
        warnings: [],
        missingFields: [],
        algorithm: 'legacy',
        algorithmVersion: '1',
        calculatedAt: '2026-01-01T00:00:00.000Z',
      },
      tazaScore: null,
      halalCheck: halalCheckFixture,
      scoreSource: 'product_record',
      canonicalFamilyId: null,
      canonicalProductId: null,
      manualScoreOverride: null,
      manualOverrideReason: null,
      manualOverrideAt: null,
      officialNutriScoreCategory: 'beverage',
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false,
      imageUrl: null,
      dataStatus: 'verified',
      source: null,
      lastVerifiedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(values.officialNutriScoreCategory).toBe('beverage')
    expect(values.fruitVegetableLegumePercent).toBe('0')
    expect(values.containsNonSugarSweeteners).toBe('false')
  })

  it('round-trips saved official fields through edit reload without guessing unknowns', () => {
    const savedPayload = formValuesToPayload({
      ...emptyProductFormValues,
      barcode: '5449000000996',
      name: 'Coca-Cola Original Taste',
      category: 'Soft Drinks',
      servingType: 'per100ml',
      energyKcal: '42',
      protein: '0',
      carbohydrates: '10.6',
      sugars: '10.6',
      fat: '0',
      saturatedFat: '0',
      fiber: '',
      salt: '0',
      officialNutriScoreCategory: 'beverage',
      fruitVegetableLegumePercent: '0',
      containsNonSugarSweeteners: 'false',
      dataStatus: 'verified',
      source: 'package',
    })

    expect(savedPayload.nutritionFacts.fiber).toBeNull()
    expect(savedPayload.fruitVegetableLegumePercent).toBe(0)
    expect(savedPayload.containsNonSugarSweeteners).toBe(false)

    const reloadedValues = productToFormValues({
      id: 'product-id',
      barcode: savedPayload.barcode,
      name: savedPayload.name,
      brand: savedPayload.brand ?? null,
      category: savedPayload.category,
      ingredients: savedPayload.ingredients,
      nutritionFacts: savedPayload.nutritionFacts,
      healthScore: 69,
      nutritionScore: {
        score: 69,
        grade: 'C',
        status: 'calculated',
        positiveReasons: [],
        negativeReasons: [],
        warnings: [],
        missingFields: [],
        algorithm: 'legacy',
        algorithmVersion: '1',
        calculatedAt: '2026-01-01T00:00:00.000Z',
      },
      tazaScore: null,
      halalCheck: halalCheckFixture,
      scoreSource: 'product_record',
      canonicalFamilyId: null,
      canonicalProductId: null,
      manualScoreOverride: null,
      manualOverrideReason: null,
      manualOverrideAt: null,
      officialNutriScoreCategory: savedPayload.officialNutriScoreCategory ?? null,
      fruitVegetableLegumePercent: savedPayload.fruitVegetableLegumePercent ?? null,
      containsNonSugarSweeteners: savedPayload.containsNonSugarSweeteners ?? null,
      imageUrl: null,
      dataStatus: savedPayload.dataStatus,
      source: savedPayload.source ?? null,
      lastVerifiedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(reloadedValues.fiber).toBe('')
    expect(reloadedValues.fruitVegetableLegumePercent).toBe('0')
    expect(reloadedValues.containsNonSugarSweeteners).toBe('false')
  })

  it('validates supported barcodes', () => {
    expect(isValidBarcode('5449000000996')).toBe(true)
    expect(isValidBarcode('invalid')).toBe(false)
  })
})
