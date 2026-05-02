# Command Center — Implementation Guide
## docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md

> **Backend:** ✅ Complete. All five CC-API phases implemented.
> **Frontend:** ❌ Not started. This guide covers everything needed for CC-Web Phases 1–4.
>
> Read this guide fully before running any CC-Web Claude Code prompt.

---

## Backend Implementation (Complete — Reference Only)

### Route Prefix and File

Platform routes are in `routes/platform.php` with the prefix `platform/v1`.
They are **not** in `routes/api.php`.

Correct route format:
```
GET  /api/platform/v1/overview
POST /api/platform/v1/auth/login
GET  /api/platform/v1/organizations
```

Never: `/api/v1/platform/*` — this is wrong and does not exist.

### Authentication Guard

```php
// config/auth.php
'guards' => [
    'platform_admin' => [
        'driver'   => 'sanctum',
        'provider' => 'admin_users',
    ],
],
'providers' => [
    'admin_users' => [
        'driver' => 'eloquent',
        'model'  => App\Models\AdminUser::class,
    ],
],
```

All platform routes use `->middleware(['auth:platform_admin'])`.
No platform route ever uses `auth:sanctum`.

### PlatformAuditService

Every platform mutation calls:
```php
PlatformAuditService::record(
    adminUser: $adminUser,
    action: 'feature_flag_override',
    entityType: 'organization',
    entityId: $organization->id,
    oldValue: $previousValue,
    newValue: $newValue,
    metadata: ['feature_key' => $featureKey]
);
```

This writes to `platform_audit_logs`. This is enforced server-side — the frontend
does not need to call any separate audit endpoint.

---

## Frontend Technology Stack

### Framework and Build

- **Framework:** Next.js (App Router) — same major version as `web/`
- **Language:** TypeScript, strict mode. No `any` types.
- **Styling:** Tailwind CSS — dark sidebar, light content area
- **Charts:** recharts — already installed
- **Icons:** lucide-react — already installed
- **Fonts:** Sora (headings), Plus Jakarta Sans (body), JetBrains Mono (data/metadata)

### Design System

The Command Center follows the Wayfield design system with one key difference:
the persistent shell uses a **dark sidebar** (`#111827`, gray-900) to visually
distinguish the CC from the tenant web admin which uses a light shell.

The main content area uses a light background (`#F9FAFB`, gray-50).
All typography, color tokens, and spacing conventions are identical to `web/`.

**No external component libraries.** Plain Tailwind CSS only.
No `@tremor/react`, no shadcn/ui, no Radix, no Headless UI.

### Apple HIG Compliance

All CC-Web screens must follow Apple Human Interface Guidelines adapted for web:

1. **Clarity:** Every UI element has a clear purpose. Labels are unambiguous.
2. **Deference:** Navigation chrome recedes. Content dominates.
3. **Depth:** Hierarchy is communicated through visual layers (dark sidebar → light content → elevated overlays).
4. **Feedback:** Every action has immediate, visible feedback (loading states, toasts, inline errors).
5. **Consistency:** Same patterns across all screens — cards, tables, modals, slide-overs, badges.
6. **Touch targets:** Minimum 44×44px for all interactive elements (even on desktop).
7. **Accessibility:** WCAG AA contrast, focus states, keyboard nav, screen reader labels.
8. **Progressive disclosure:** Don't show content or options that aren't relevant to the current role or context.

---

## Platform API Client

Create this file at `command/lib/platform-api.ts`. All API calls in the CC must
use this client — never use `fetch` directly in page or component files.

```typescript
// command/lib/platform-api.ts

const PLATFORM_API_BASE =
  process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? 'http://localhost:8000/api/platform/v1';

// Token storage — MUST use a key that does not conflict with web/ tenant tokens
const TOKEN_KEY = 'cc_platform_token';

export function getPlatformToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setPlatformToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearPlatformToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function platformRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const token = getPlatformToken();

  const res = await fetch(`${PLATFORM_API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearPlatformToken();
    window.location.href = '/login';
    throw new Error('Unauthenticated');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(error.message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const platformApi = {
  get: <T>(path: string) => platformRequest<T>('GET', path),
  post: <T>(path: string, body?: unknown) => platformRequest<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => platformRequest<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => platformRequest<T>('PATCH', path, body),
  delete: <T>(path: string) => platformRequest<T>('DELETE', path),
};
```

**Critical isolation rule:** This client always uses `NEXT_PUBLIC_PLATFORM_API_URL`.
It must never send requests to routes under `/api/v1/` (tenant routes).
Tenant tokens from `web/` must never appear in CC API calls.

---

## Admin User Context

```typescript
// command/context/AdminUserContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { platformApi, clearPlatformToken, getPlatformToken } from '@/lib/platform-api';

export type AdminRole = 'super_admin' | 'admin' | 'support' | 'billing' | 'readonly';

export interface AdminUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: AdminRole;
}

interface AdminUserContextValue {
  adminUser: AdminUser | null;
  isLoading: boolean;
  setAdminUser: (user: AdminUser | null) => void;
  logout: () => void;
}

const AdminUserContext = createContext<AdminUserContextValue | null>(null);

export function AdminUserProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) { setIsLoading(false); return; }

    platformApi.get<AdminUser>('/me')
      .then(setAdminUser)
      .catch(() => { clearPlatformToken(); })
      .finally(() => setIsLoading(false));
  }, []);

  function logout() {
    platformApi.post('/auth/logout').catch(() => {});
    clearPlatformToken();
    setAdminUser(null);
    window.location.href = '/login';
  }

  return (
    <AdminUserContext.Provider value={{ adminUser, isLoading, setAdminUser, logout }}>
      {children}
    </AdminUserContext.Provider>
  );
}

export function useAdminUser(): AdminUserContextValue {
  const ctx = useContext(AdminUserContext);
  if (!ctx) throw new Error('useAdminUser must be used within AdminUserProvider');
  return ctx;
}

// Role helpers
export const can = {
  manageBilling: (role: AdminRole) => ['super_admin', 'billing'].includes(role),
  manageFeatureFlags: (role: AdminRole) => ['super_admin', 'admin'].includes(role),
  viewUsers: (role: AdminRole) => ['super_admin', 'admin', 'support'].includes(role),
  viewFinancials: (role: AdminRole) => ['super_admin', 'billing'].includes(role),
  viewSupport: (role: AdminRole) => ['super_admin', 'admin', 'support'].includes(role),
  manageAutomations: (role: AdminRole) => ['super_admin', 'admin'].includes(role),
  viewAuditLog: (role: AdminRole) => ['super_admin', 'admin'].includes(role),
  manageSettings: (role: AdminRole) => role === 'super_admin',
};
```

---

## Authenticated Layout

```typescript
// command/app/(admin)/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminUser } from '@/context/AdminUserContext';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { adminUser, isLoading } = useAdminUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !adminUser) {
      router.replace('/login');
    }
  }, [adminUser, isLoading, router]);

  if (isLoading) return <div className="min-h-screen bg-gray-900" />; // prevent flash
  if (!adminUser) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <div className="flex flex-1 pt-14"> {/* pt-14 = top bar height */}
        <Sidebar />
        <main className="flex-1 ml-56 bg-gray-50 min-h-[calc(100vh-56px)] overflow-y-auto">
          <div className="px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

---

## Reusable Component Patterns

These patterns must be consistent across all CC-Web screens.

### Stat Card

```tsx
// components/StatCard.tsx
interface StatCardProps {
  label: string;       // section label (font-mono, uppercase)
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  alert?: boolean;     // red border/bg for critical metrics
}

// Structure:
// bg-white rounded-xl border border-gray-200 shadow-sm p-6
// label: font-mono text-xs uppercase tracking-widest text-gray-400 mb-1
// value: font-heading text-3xl font-bold text-gray-900
// subtitle: text-sm text-gray-500 mt-1
```

### Data Table

```tsx
// Plain HTML table, no library
// Wrapper: bg-white rounded-xl border border-gray-200 overflow-hidden
// thead: bg-gray-50 border-b border-gray-200
// th: text-left px-6 py-3 font-mono text-xs uppercase tracking-widest text-gray-500
// tbody: divide-y divide-gray-100
// tr: hover:bg-gray-50 transition-colors duration-100
// td: px-6 py-4 text-sm text-gray-900
```

### Status Badge

```tsx
// Active / healthy
<span className="inline-flex items-center px-2 py-0.5 rounded-full
  text-xs font-mono font-medium bg-teal-50 text-teal-700 border border-teal-100">
  Active
</span>

// Warning / pending
<span className="inline-flex items-center px-2 py-0.5 rounded-full
  text-xs font-mono font-medium bg-orange-50 text-orange-700 border border-orange-100">
  Past Due
</span>

// Error / suspended / critical
<span className="inline-flex items-center px-2 py-0.5 rounded-full
  text-xs font-mono font-medium bg-red-50 text-red-700 border border-red-100">
  Suspended
</span>

// Neutral
<span className="inline-flex items-center px-2 py-0.5 rounded-full
  text-xs font-mono font-medium bg-gray-100 text-gray-600 border border-gray-200">
  Inactive
</span>
```

### Plan Badge

```tsx
// Maps plan_code to badge color
const planColors = {
  free:       'bg-gray-100 text-gray-600 border-gray-200',
  starter:    'bg-teal-50 text-teal-700 border-teal-100',
  pro:        'bg-orange-50 text-orange-700 border-orange-100',
  enterprise: 'bg-purple-50 text-purple-700 border-purple-100',
};
```

### Usage Bar (for limits)

```tsx
// Usage bars: green → amber at 80% → red at 100%
// percent = (used / limit) * 100
const barColor =
  percent >= 100 ? 'bg-red-500' :
  percent >= 80  ? 'bg-amber-500' :
                   'bg-teal-500';

// <div className="w-full bg-gray-100 rounded-full h-2">
//   <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(percent, 100)}%` }} />
// </div>
```

### Confirmation Modal (Destructive)

```tsx
// bg-white rounded-2xl shadow-xl w-full max-w-md
// Cannot be dismissed by clicking backdrop
// Heading: Sora 18px gray-900
// Body: Plus Jakarta Sans 14px gray-600
// Cancel: plain button, gray-600
// Confirm: bg-[#E94F37] text-white rounded-lg px-4 py-2.5 min-h-[44px]
```

### Slide-Over

```tsx
// Fixed right-0 top-0 h-full w-[480px]
// bg-white shadow-xl z-50
// Backdrop: fixed inset-0 bg-black/40 z-40
// Header: border-b border-gray-100, h-16, px-6, flex items-center justify-between
// Close button: lucide X icon, 44x44px touch target
// Content: overflow-y-auto, flex-1, px-6 py-6
```

### Toast Notification

```tsx
// Position: fixed top-4 right-4 z-50 flex flex-col gap-2
// Each toast: flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg min-w-64 max-w-sm
// Success: bg-green-600 text-white
// Error: bg-red-600 text-white
// Info: bg-blue-600 text-white
// Auto-dismiss: 4000ms
// Animation: slide in from right (translate-x-full → 0), fade out on dismiss
```

---

## recharts Configuration

All charts use recharts with Wayfield colors.

```typescript
// Shared chart colors
export const CHART_COLORS = {
  teal:   '#0FA3B1',
  orange: '#E67E22',
  coral:  '#E94F37',
  blue:   '#7EA8BE',
  gray:   '#9CA3AF',
};

// Plan distribution colors
export const PLAN_COLORS = {
  free:       '#9CA3AF',
  starter:    '#0FA3B1',
  pro:        '#E67E22',
  enterprise: '#8B5CF6',
};
```

Standard chart wrapper:
```tsx
<ResponsiveContainer width="100%" height={200}>
  {/* chart component */}
</ResponsiveContainer>
```

CartesianGrid: `strokeDasharray="3 3" stroke="#F3F4F6"`
Axis ticks: `fontSize={11} fontFamily="'JetBrains Mono', monospace" fill="#6B7280"`
Tooltip: custom styled to match Wayfield design tokens

---

## Environment Variables

```bash
# command/.env.local (development)
NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:8000/api/platform/v1

# command/.env.production
NEXT_PUBLIC_PLATFORM_API_URL=https://api.wayfieldapp.com/api/platform/v1

# Support tool URL (used in CC-Web Phase 3 Support section)
NEXT_PUBLIC_SUPPORT_TOOL_URL=https://wayfield.freshdesk.com  # or configured tool
```

---

## Build Sequence

Build CC-Web phases in strict order. Each phase depends on the previous.

| Phase | Contents | Prerequisite |
|---|---|---|
| CC-Web 1 | Auth, shell, overview dashboard | None (start here) |
| CC-Web 2 | Organisation management (list + detail + tabs) | Phase 1 complete |
| CC-Web 3 | Users, Financials, Support | Phase 2 complete |
| CC-Web 4 | Automations, Security, Audit Log, Settings | Phase 3 complete |

---

## Testing Requirements

Each CC-Web phase must include tests covering:

1. **Auth isolation** — platform token never sent to `/api/v1/*` routes;
   tenant tokens rejected on all platform routes (test with curl or API test)
2. **Route guard** — unauthenticated access to `/` redirects to `/login`
3. **Role-based visibility** — items hidden for roles that can't access them
4. **Role-based redirect** — `/settings` redirects non-super_admin to `/`
5. **Last-super-admin guard** — UI surfaces the error when API rejects demotion
6. **Audit trail** — every mutation produces a `platform_audit_logs` entry (verify via API)
7. **Stale data notice** — Stripe mirror notice is always present on Financials and Billing tab
8. **Automation notice** — execution-engine-not-implemented notice is always present on Automations

---

## Anti-Drift Protocol

To prevent Claude Code from drifting from the specification across sessions:

Every CC-Web prompt opens with:
```
Read before writing any code:
@../docs/command_center/COMMAND_CENTER_OVERVIEW.md
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md
@../docs/command_center/COMMAND_CENTER_SCHEMA.md
```

The prompt then states all non-negotiable rules explicitly:
- Route prefix: `/api/platform/v1/` (not `/api/v1/platform/`)
- Audit table: `platform_audit_logs` (not `audit_logs`)
- Token key: `cc_platform_token`
- Guard: `auth:platform_admin`
- Table: `admin_users` (`platform_admins` is deprecated — never reference it)
- No external UI libraries — plain Tailwind + recharts + lucide-react

One branch per phase: `cc/web-phase-1`, `cc/web-phase-2`, etc.
Commit after each Part within a phase.
Tests must be green before each commit.
