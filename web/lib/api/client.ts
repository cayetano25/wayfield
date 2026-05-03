import { clearToken, clearStoredUser, getToken } from '@/lib/auth/session';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string[]>,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class MaintenanceError extends Error {
  constructor(message = 'System under maintenance') {
    super(message);
    this.name = 'MaintenanceError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 503 && res.headers.get('X-Maintenance-Mode') === 'true') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wayfield:maintenance', { detail: { active: true } }));
    }
    throw new MaintenanceError();
  }

  if (res.status === 401) {
    const hadToken = !!token;
    clearToken();
    clearStoredUser();
    if (hadToken && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    let errors: Record<string, string[]> | undefined;
    let code: string | undefined;
    try {
      const json = await res.json();
      message = json.message ?? message;
      errors = json.errors;
      code = json.error;
      if (json.error === 'plan_limit_reached' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wayfield:plan_limit_reached', { detail: json }));
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message, errors, code);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PUT', path, body);
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('DELETE', path, body);
}
