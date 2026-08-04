import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../../../core/api/api-client'
import { createMockResponse } from '../../../test/test-utils'
import { SubmissionsApi } from './submissions-api'

const api = () => new SubmissionsApi(new ApiClient('http://localhost:4000'))

describe('SubmissionsApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads submissions with status filter', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({ data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }),
    )

    await api().list({ page: 1, pageSize: 10, status: 'pending' })

    expect(fetchSpy.mock.calls[0]?.[0]).toContain('status=pending')
  })

  it('loads submission details', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({ data: { id: 'submission-id' } }),
    )

    await api().findById('submission-id')

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('http://localhost:4000/product-submissions/submission-id')
  })

  it('approves a submission', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({ data: { id: 'submission-id', status: 'approved' } }),
    )

    await api().approve(
      'submission-id',
      {
        barcode: '5449000000996',
        name: 'Coca-Cola',
        category: 'Soft Drinks',
        ingredients: [],
        servingType: 'per100ml',
      },
      'token',
    )

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe('POST')
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer token')
  })

  it('rejects a submission', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({ data: { id: 'submission-id', status: 'rejected' } }),
    )

    await api().updateStatus('submission-id', { status: 'rejected', moderationNote: 'Unreadable' }, 'token')

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe('PUT')
  })

  it('marks a submission as needs correction', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({ data: { id: 'submission-id', status: 'needs_correction' } }),
    )

    await api().updateStatus('submission-id', { status: 'needs_correction', moderationNote: 'Need label' }, 'token')

    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(requestInit.body as string)
    expect(body.status).toBe('needs_correction')
  })

  it('surfaces duplicate barcode errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({ error: { message: 'Barcode already exists' } }, 409),
    )

    await expect(
      api().approve(
        'submission-id',
        {
          barcode: '5449000000996',
          name: 'Coca-Cola',
          category: 'Soft Drinks',
          ingredients: [],
          servingType: 'per100ml',
        },
        'token',
      ),
    ).rejects.toMatchObject({ statusCode: 409, message: 'Barcode already exists' })
  })
})
