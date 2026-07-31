import { describe, expect, it } from 'vitest'
import { emptyProductFormValues, formValuesToPayload } from './product-form'
import { isValidBarcode } from './barcode'

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
  })

  it('validates supported barcodes', () => {
    expect(isValidBarcode('5449000000996')).toBe(true)
    expect(isValidBarcode('invalid')).toBe(false)
  })
})
