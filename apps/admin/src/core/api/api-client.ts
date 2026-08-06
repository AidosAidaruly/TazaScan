import { env } from "../../config/env";
import { ApiError, type FieldErrors } from "../errors/api-error";

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

type MultipartRequestOptions = {
  method?: string;
  formData: FormData;
  token?: string | null;
};

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl = env.apiBaseUrl) {
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers();
    headers.set("Accept", "application/json");

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (options.token) {
      headers.set("Authorization", `Bearer ${options.token}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(
        response.status,
        readErrorMessage(payload),
        readFieldErrors(payload),
      );
    }

    return payload as T;
  }

  async requestMultipart<T>(
    path: string,
    options: MultipartRequestOptions,
  ): Promise<T> {
    const headers = new Headers();
    headers.set("Accept", "application/json");

    if (options.token) {
      headers.set("Authorization", `Bearer ${options.token}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "POST",
      headers,
      body: options.formData,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(
        response.status,
        readErrorMessage(payload),
        readFieldErrors(payload),
      );
    }

    return payload as T;
  }
}

function readErrorMessage(payload: unknown) {
  if (
    isRecord(payload) &&
    isRecord(payload.error) &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return "Request failed";
}

function readFieldErrors(payload: unknown): FieldErrors {
  if (
    !isRecord(payload) ||
    !isRecord(payload.error) ||
    !isRecord(payload.error.details)
  ) {
    return {};
  }

  const fieldErrors = payload.error.details.fieldErrors;

  if (!isRecord(fieldErrors)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(fieldErrors).flatMap(([key, value]) => {
      if (Array.isArray(value) && typeof value[0] === "string") {
        return [[key, value[0]]];
      }

      return [];
    }),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
