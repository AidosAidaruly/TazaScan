import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from './api-client'
import { createMockResponse } from '../../test/test-utils'

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns payload for successful requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({ data: { ok: true } }),
    )

    const result = await new ApiClient('http://localhost:4000').request('/products')

    expect(result).toEqual({ data: { ok: true } })
  })

  it('maps validation errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse(
        {
          error: {
            message: 'Validation failed',
            details: { fieldErrors: { barcode: ['Invalid barcode'] } },
          },
        },
        400,
      ),
    )

    await expect(
      new ApiClient('http://localhost:4000').request('/products'),
    ).rejects.toMatchObject({
      statusCode: 400,
      fieldErrors: { barcode: 'Invalid barcode' },
    })
  })
})
