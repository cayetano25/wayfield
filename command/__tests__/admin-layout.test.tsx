import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/overview',
}));

vi.mock('@/components/Sidebar', () => ({
  default: () => <div data-testid="sidebar" />,
}));

vi.mock('@/components/TopBar', () => ({
  default: () => <div data-testid="topbar" />,
}));

describe('AdminLayout — route guard', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    vi.resetModules();
  });

  it('redirects to /login when no adminUser and not loading', async () => {
    vi.doMock('@/contexts/AdminUserContext', () => ({
      useAdminUser: () => ({ adminUser: null, isLoading: false, setAdminUser: vi.fn(), logout: vi.fn() }),
    }));

    const { default: Layout } = await import('@/app/(admin)/layout');
    render(<Layout>children</Layout>);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('renders children when adminUser is present', async () => {
    const mockUser = { id: 1, first_name: 'Tom', last_name: 'Admin', email: 'tom@w.io', role: 'super_admin' as const, is_active: true, can_impersonate: false, last_login_at: null };
    vi.doMock('@/contexts/AdminUserContext', () => ({
      useAdminUser: () => ({ adminUser: mockUser, isLoading: false, setAdminUser: vi.fn(), logout: vi.fn() }),
    }));

    const { default: Layout } = await import('@/app/(admin)/layout');
    const { getByText } = render(<Layout><div>dashboard content</div></Layout>);

    expect(getByText('dashboard content')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows dark loading state while isLoading is true', async () => {
    vi.doMock('@/contexts/AdminUserContext', () => ({
      useAdminUser: () => ({ adminUser: null, isLoading: true, setAdminUser: vi.fn(), logout: vi.fn() }),
    }));

    const { default: Layout } = await import('@/app/(admin)/layout');
    const { container } = render(<Layout>children</Layout>);

    // Loading state is a dark div, not children or redirect
    expect(mockReplace).not.toHaveBeenCalled();
    expect(container.querySelector('.bg-gray-900')).toBeInTheDocument();
  });
});
