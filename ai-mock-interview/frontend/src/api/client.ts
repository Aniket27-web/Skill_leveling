import { ApiErrorResponse, ApiErrorDetail } from './types';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers: customHeaders, ...restOptions } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(customHeaders);

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData && body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const config: RequestInit = {
    ...restOptions,
    headers,
    credentials: 'include',
    body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: unknown) {
    throw new ApiError(
      err instanceof Error ? err.message : 'Network request failed',
      'network_error',
      0
    );
  }

  if (response.status === 401) {
    // Avoid redirect loop if already on auth page
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/register') {
      window.location.href = '/login';
    }
  }

  if (!response.ok) {
    let errorDetail: ApiErrorDetail = {
      code: `http_${response.status}`,
      message: response.statusText || `Request failed with status ${response.status}`,
    };

    try {
      const data = (await response.json()) as ApiErrorResponse;
      if (data && data.error && typeof data.error.message === 'string') {
        errorDetail = data.error;
      }
    } catch {
      // Failed to parse JSON error, fall back to default
    }

    throw new ApiError(errorDetail.message, errorDetail.code, response.status, errorDetail.details);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  // Handle Blob downloads if response is binary or specified
  const contentType = response.headers.get('content-type');
  if (contentType && (contentType.includes('application/pdf') || contentType.includes('application/octet-stream') || contentType.includes('text/csv'))) {
    return (await response.blob()) as unknown as T;
  }

  return response.json() as Promise<T>;
}
