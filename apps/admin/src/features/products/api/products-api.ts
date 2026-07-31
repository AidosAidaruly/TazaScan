import { ApiClient } from '../../../core/api/api-client'
import type { ProductListResponse, ProductPayload, ProductResponse } from '../types'

export type ProductListParams = {
  page: number
  pageSize: number
  name?: string
  brand?: string
  barcode?: string
}

export class ProductsApi {
  private readonly apiClient: ApiClient

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient
  }

  list(params: ProductListParams) {
    const searchParams = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
    })

    if (params.name) searchParams.set('name', params.name)
    if (params.brand) searchParams.set('brand', params.brand)
    if (params.barcode) searchParams.set('barcode', params.barcode)

    return this.apiClient.request<ProductListResponse>(`/products?${searchParams}`)
  }

  findById(id: string) {
    return this.apiClient.request<ProductResponse>(`/products/${id}`)
  }

  create(payload: ProductPayload, token: string) {
    return this.apiClient.request<ProductResponse>('/products', {
      method: 'POST',
      body: payload,
      token,
    })
  }

  update(id: string, payload: Partial<ProductPayload>, token: string) {
    return this.apiClient.request<ProductResponse>(`/products/${id}`, {
      method: 'PUT',
      body: payload,
      token,
    })
  }

  delete(id: string, token: string) {
    return this.apiClient.request<void>(`/products/${id}`, {
      method: 'DELETE',
      token,
    })
  }
}
