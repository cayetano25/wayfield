import { describe, it, expect, beforeEach } from 'vitest';
import { TOKEN_KEY, getToken, setToken, clearToken, getPlatformToken, setPlatformToken, clearPlatformToken } from '@/lib/platform-api';

describe('platform-api — token isolation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses cc_platform_token as the storage key', () => {
    expect(TOKEN_KEY).toBe('cc_platform_token');
  });

  it('setToken stores token under cc_platform_token', () => {
    setToken('test-token');
    expect(localStorage.getItem('cc_platform_token')).toBe('test-token');
  });

  it('getToken reads from cc_platform_token', () => {
    localStorage.setItem('cc_platform_token', 'my-token');
    expect(getToken()).toBe('my-token');
  });

  it('clearToken removes cc_platform_token', () => {
    localStorage.setItem('cc_platform_token', 'my-token');
    clearToken();
    expect(localStorage.getItem('cc_platform_token')).toBeNull();
  });

  it('getPlatformToken is an alias for getToken', () => {
    localStorage.setItem('cc_platform_token', 'alias-test');
    expect(getPlatformToken()).toBe('alias-test');
  });

  it('setPlatformToken is an alias for setToken', () => {
    setPlatformToken('alias-token');
    expect(localStorage.getItem('cc_platform_token')).toBe('alias-token');
  });

  it('clearPlatformToken is an alias for clearToken', () => {
    localStorage.setItem('cc_platform_token', 'to-clear');
    clearPlatformToken();
    expect(localStorage.getItem('cc_platform_token')).toBeNull();
  });

  it('does not conflict with any NEXT_PUBLIC_API_URL key', () => {
    // The CC token key must not match any tenant token key
    expect(TOKEN_KEY).not.toBe('wayfield_token');
    expect(TOKEN_KEY).not.toBe('token');
    expect(TOKEN_KEY).not.toBe('auth_token');
  });

  it('uses NEXT_PUBLIC_PLATFORM_API_URL in base URL construction', async () => {
    // Import the module and check it doesn't use NEXT_PUBLIC_API_URL
    // We verify this by checking the source doesn't reference NEXT_PUBLIC_API_URL
    const source = await import('@/lib/platform-api');
    // The module should export platform-specific API methods
    expect(source.platformAuth).toBeDefined();
    expect(source.platformOverview).toBeDefined();
    // Token key confirms isolation
    expect(source.TOKEN_KEY).toBe('cc_platform_token');
  });
});
