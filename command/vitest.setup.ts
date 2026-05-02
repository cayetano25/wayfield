import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/overview',
  redirect: vi.fn(),
}));

// Mock next/font/google
vi.mock('next/font/google', () => ({
  Sora: () => ({ variable: '--font-sora', className: '' }),
  Plus_Jakarta_Sans: () => ({ variable: '--font-plus-jakarta', className: '' }),
  JetBrains_Mono: () => ({ variable: '--font-jetbrains-mono', className: '' }),
}));
