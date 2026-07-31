import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../../../core/api/api-client'
import { ApiError } from '../../../core/errors/api-error'
import { createMockResponse } from '../../../test/test-utils'
import { AuthApi } from './auth-api'

describe('AuthApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('logs in successfully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({
        data: {
          accessToken: 'token',
          user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' },
        },
      }),
    )

    const response = await new AuthApi(new ApiClient('http://localhost:4000')).login(
      'admin@example.com',
      'password',
    )

    expect(response.data.accessToken).toBe('token')
  })

  it('rejects invalid login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      await createMockResponse({ error: { message: 'Invalid email or password' } }, 401),
    )

    await expect(
      new AuthApi(new ApiClient('http://localhost:4000')).login('admin@example.com', 'bad'),
    ).rejects.toBeInstanceOf(ApiError)
  })
})
