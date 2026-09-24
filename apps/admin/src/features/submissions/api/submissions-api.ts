import { ApiClient } from '../../../core/api/api-client'
import type {
  ApproveSubmissionPayload,
  SubmissionListResponse,
  SubmissionResponse,
  SubmissionStatus,
} from '../types'

export class SubmissionsApi {
  private readonly apiClient: ApiClient

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient
  }

  list(params: { page: number; pageSize: number; status?: SubmissionStatus }, token: string) {
    const searchParams = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
    })

    if (params.status) searchParams.set('status', params.status)

    return this.apiClient.request<SubmissionListResponse>(`/product-submissions?${searchParams}`, { token })
  }

  findById(id: string, token: string) {
    return this.apiClient.request<SubmissionResponse>(`/product-submissions/${id}`, { token })
  }

  updateStatus(id: string, payload: { status: 'rejected' | 'needs_correction'; moderationNote: string }, token: string) {
    return this.apiClient.request<SubmissionResponse>(`/product-submissions/${id}/status`, {
      method: 'PUT',
      body: payload,
      token,
    })
  }

  approve(id: string, payload: ApproveSubmissionPayload, token: string) {
    return this.apiClient.request<SubmissionResponse>(`/product-submissions/${id}/approve`, {
      method: 'POST',
      body: payload,
      token,
    })
  }
}
