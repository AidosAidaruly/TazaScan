import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../../../core/api/api-client'
import { createMockResponse } from '../../../test/test-utils'
import { ProductsApi } from './products-api'

const api = () => new ProductsApi(new ApiClient('http://localhost:4000'))

describe('ProductsApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads products with search and pagination', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({ data: [], pagination: { page: 2, pageSize: 10, total: 0, totalPages: 0 } }),
    )

    await api().list({ page: 2, pageSize: 10, name: 'cola', brand: 'coca', barcode: '544' })

    expect(fetchSpy.mock.calls[0]?.[0]).toContain('page=2')
    expect(fetchSpy.mock.calls[0]?.[0]).toContain('name=cola')
    expect(fetchSpy.mock.calls[0]?.[0]).toContain('brand=coca')
    expect(fetchSpy.mock.calls[0]?.[0]).toContain('barcode=544')
  })

  it('creates a product with bearer token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({ data: { id: 'product-id' } }),
    )

    await api().create(
      {
        barcode: '5449000000996',
        name: 'Coca-Cola',
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
        dataStatus: 'verified',
      },
      'token',
    )

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer token')
  })

  it('updates a product with bearer token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({ data: { id: 'product-id' } }),
    )

    await api().update('product-id', { name: 'Updated product' }, 'token')

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('http://localhost:4000/products/product-id')
    expect(init.method).toBe('PUT')
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer token')
  })

  it('deletes a product with bearer token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({}, 204),
    )

    await api().delete('product-id', 'token')

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe('DELETE')
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer token')
  })

  it('surfaces duplicate barcode errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({ error: { message: 'Barcode already exists' } }, 409),
    )

    await expect(
      api().create(
        {
          barcode: '5449000000996',
          name: 'Coca-Cola',
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
          dataStatus: 'verified',
        },
        'token',
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Barcode already exists',
    })
  })
})
