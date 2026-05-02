import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/login/page';
import * as platformApi from '@/lib/platform-api';

// Mock the AdminUserContext
const mockSetAdminUser = vi.fn();
vi.mock('@/contexts/AdminUserContext', () => ({
  useAdminUser: () => ({
    adminUser: null,
    isLoading: false,
    setAdminUser: mockSetAdminUser,
    logout: vi.fn(),
  }),
}));

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/login',
  redirect: vi.fn(),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockReplace.mockClear();
    mockSetAdminUser.mockClear();
    vi.spyOn(platformApi.platformAuth, 'login').mockReset();
    vi.spyOn(platformApi, 'getToken').mockReturnValue(null);
  });

  it('renders the login form', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows error on invalid credentials (401)', async () => {
    const error = Object.assign(new Error('Unauthorized'), { response: { status: 401 } });
    vi.spyOn(platformApi.platformAuth, 'login').mockRejectedValue(error);

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'bad@test.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(localStorage.getItem('cc_platform_token')).toBeNull();
  });

  it('redirects to /overview on valid credentials', async () => {
    const mockAdminUser = { id: 1, first_name: 'Tom', last_name: 'Admin', email: 'tom@wayfield.io', role: 'super_admin' as const, is_active: true, can_impersonate: false, last_login_at: null };
    vi.spyOn(platformApi.platformAuth, 'login').mockResolvedValue({ data: { token: 'test-token-123', admin_user: mockAdminUser } } as never);
    vi.spyOn(platformApi, 'setToken');

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'tom@wayfield.io');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(platformApi.setToken).toHaveBeenCalledWith('test-token-123');
      expect(mockSetAdminUser).toHaveBeenCalledWith(mockAdminUser);
      expect(mockReplace).toHaveBeenCalledWith('/overview');
    });
  });

  it('shows inactive account error on 403', async () => {
    const error = Object.assign(new Error('Forbidden'), { response: { status: 403 } });
    vi.spyOn(platformApi.platformAuth, 'login').mockRejectedValue(error);

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'inactive@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/inactive/i)).toBeInTheDocument();
    });
  });

  it('redirects immediately if token exists', async () => {
    vi.spyOn(platformApi, 'getToken').mockReturnValue('existing-token');
    render(<LoginPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/overview');
    });
  });
});
