/**
 * API クライアント
 *
 * すべての API 呼び出しに共通のロジック（エラーハンドリング、JWT 自動付与など）を提供
 */

// 同じWorkerランタイムにデプロイされるため、常に相対パスを使用
const API_BASE_URL = '/api';

export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new APIError(response.status, data.error || 'An error occurred');
  }

  return data;
}

export const api = {
  get: <T>(endpoint: string, token?: string | null) =>
    fetchAPI<T>(endpoint, { method: 'GET' }, token),

  post: <T>(endpoint: string, body?: unknown, token?: string | null) =>
    fetchAPI<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }, token),

  put: <T>(endpoint: string, body?: unknown, token?: string | null) =>
    fetchAPI<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }, token),

  delete: <T>(endpoint: string, token?: string | null) =>
    fetchAPI<T>(endpoint, { method: 'DELETE' }, token),
};
