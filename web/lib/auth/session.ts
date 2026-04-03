export interface AdminUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  email_verified: boolean;
  is_active: boolean;
  organizations: Array<{
    id: number;
    name: string;
    slug: string;
    role: string;
    plan_code: string;
  }>;
}

const TOKEN_KEY = 'wayfield_token';
const USER_KEY = 'wayfield_user';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, options: { secure?: boolean; maxAge?: number } = {}): void {
  if (typeof document === 'undefined') return;
  const secure = options.secure ?? process.env.NODE_ENV === 'production';
  const maxAge = options.maxAge ?? 60 * 60 * 24 * 7; // 7 days
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `path=/`,
    `samesite=lax`,
    `max-age=${maxAge}`,
  ];
  if (secure) parts.push('secure');
  document.cookie = parts.join('; ');
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

export function getToken(): string | null {
  return getCookie(TOKEN_KEY);
}

export function setToken(token: string): void {
  setCookie(TOKEN_KEY, token);
}

export function clearToken(): void {
  deleteCookie(TOKEN_KEY);
}

export function getStoredUser(): AdminUser | null {
  const raw = getCookie(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: object): void {
  setCookie(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  deleteCookie(USER_KEY);
}
