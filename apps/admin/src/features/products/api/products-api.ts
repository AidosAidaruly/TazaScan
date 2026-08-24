import { ApiClient } from "../../../core/api/api-client";
import type {
  ProductListResponse,
  ProductPayload,
  HalalCertificationPayload,
  OfficialNutriScorePreviewResponse,
  ProductResponse,
  TazaScorePreviewResponse,
} from "../types";

export type ProductListParams = {
  page: number;
  pageSize: number;
  name?: string;
  brand?: string;
  barcode?: string;
};

export class ProductsApi {
  private readonly apiClient: ApiClient;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  list(params: ProductListParams) {
    const searchParams = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
    });

    if (params.name) searchParams.set("name", params.name);
    if (params.brand) searchParams.set("brand", params.brand);
    if (params.barcode) searchParams.set("barcode", params.barcode);

    return this.apiClient.request<ProductListResponse>(
      `/products?${searchParams}`,
    );
  }

  findById(id: string) {
    return this.apiClient.request<ProductResponse>(`/products/${id}`);
  }

  create(payload: ProductPayload, token: string) {
    return this.apiClient.request<ProductResponse>("/products", {
      method: "POST",
      body: payload,
      token,
    });
  }

  previewOfficialNutriScore(payload: ProductPayload, token: string) {
    return this.apiClient.request<OfficialNutriScorePreviewResponse>(
      "/products/nutri-score-preview",
      {
        method: "POST",
        body: payload,
        token,
      },
    );
  }

  previewTazaScore(payload: ProductPayload, token: string) {
    return this.apiClient.request<TazaScorePreviewResponse>(
      "/products/taza-score-preview",
      {
        method: "POST",
        body: payload,
        token,
      },
    );
  }

  update(id: string, payload: Partial<ProductPayload>, token: string) {
    return this.apiClient.request<ProductResponse>(`/products/${id}`, {
      method: "PUT",
      body: payload,
      token,
    });
  }

  delete(id: string, token: string) {
    return this.apiClient.request<void>(`/products/${id}`, {
      method: "DELETE",
      token,
    });
  }

  uploadImage(id: string, image: File, token: string) {
    const formData = new FormData();
    formData.set("image", image);

    return this.apiClient.requestMultipart<ProductResponse>(
      `/products/${id}/image`,
      {
        formData,
        token,
      },
    );
  }

  removeImage(id: string, token: string) {
    return this.apiClient.request<ProductResponse>(`/products/${id}/image`, {
      method: "DELETE",
      token,
    });
  }

  updateHalalCertification(
    id: string,
    payload: HalalCertificationPayload,
    token: string,
  ) {
    return this.apiClient.request<ProductResponse>(
      `/products/${id}/halal-certification`,
      {
        method: "PUT",
        body: payload,
        token,
      },
    );
  }

  clearHalalCertification(id: string, token: string) {
    return this.apiClient.request<ProductResponse>(
      `/products/${id}/halal-certification`,
      {
        method: "DELETE",
        token,
      },
    );
  }
}
