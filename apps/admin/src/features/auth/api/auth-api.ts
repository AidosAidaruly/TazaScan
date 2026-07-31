import { ApiClient } from '../../../core/api/api-client'
import type { LoginResponse, MeResponse } from '../types'

export class AuthApi {
  private readonly apiClient: ApiClient

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient
  }

  login(email: string, password: string) {
    return this.apiClient.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
  }

  me(token: string) {
    return this.apiClient.request<MeResponse>('/auth/me', {
      token,
    })
  }
}
