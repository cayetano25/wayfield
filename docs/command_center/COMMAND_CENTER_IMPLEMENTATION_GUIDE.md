# Command Center — Implementation Guide
## docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md

> **Backend:** Complete. All five CC-API phases implemented.
> **Frontend:** Not started. This guide covers what is needed to build CC-Web Phases 1–4.

---

## Backend Implementation (Complete)

### Authentication Guard

The Command Center uses a dedicated Laravel Sanctum guard named `platform_admin`.
This guard is backed by the `admin_users` table, not the `users` table.

**Guard configuration (guards in `config/auth.php`):**
```php
'platform_admin' => [
    'driver' => 'sanctum',
    'provider' => 'admin_users',
],
'providers' => [
    'admin_users' => [
        'driver' => 'eloquent',
        'model' => App\Models\AdminUser::class,
    ],
],
```

**Middleware applied to all platform routes:**
```php
Route::prefix('platform/v1')
    ->middleware(['auth:platform_admin'])
    ->group(function () { ... });
```

All tenant API routes use `auth:sanctum` only. The two guards never overlap.

### Platform Route File

Platform routes are defined in a separate route file (e.g. `routes/platform.php`)
and registered with the `platform/v1` prefix. They are not in `routes/api.php`.

### PlatformAuditService

Every mutation of tenant data by a platform admin calls:
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

This writes to `platform_audit_logs`. This call must not be omitted for any
platform mutation endpoint.

### Domain Services in the Platform Layer

| Service / Action | Purpose |
|---|---|
| `PlatformAuditService` | Platform admin mutation audit trail |
| `ProcessStripeEventJob` | Handle incoming Stripe webhook events (schema exists; handler not wired) |
| Automation trigger/action interfaces | Schema and interfaces defined; no execution engine |

### Key Implementation Decisions

**DEC-009:** Platform admin auth is completely isolated from tenant auth.
A tenant token is always rejected on platform routes. A platform admin token
is always rejected on tenant routes.

**DEC-022:** Command Center is a separate Next.js app (`command/`) with its own
build pipeline, auth context, and API client pointing to `/api/platform/v1/`.

**DEC-023:** Stripe handles all billing. Data is mirrored locally via webhooks.
The Stripe webhook handler is not yet wired (see OPEN_QUESTIONS Q4).

---

## Frontend Build Guide

### Technology Conventions

The Command Center frontend must follow these conventions:

- **Framework:** Next.js (same version as `web/`)
- **Styling:** Tailwind CSS — use dark theme as the base (Command Center uses
  a dark sidebar shell unlike the tenant web admin)
- **State:** React Context for admin user state (analogous to `UserContext` in `web/`)
- **API client:** Dedicated platform API client pointing to `/api/platform/v1/`
  using the platform admin token — completely separate from the tenant API client
- **Auth storage:** Platform admin token stored separately from any tenant token.
  Never use the same storage key.

### Auth Flow for CC Frontend

1. Platform admin navigates to `command/` login screen
2. `POST /api/platform/v1/auth/login` with email + password
3. Response contains platform admin token
4. Token stored in `localStorage` or `httpOnly` cookie (key: `cc_platform_token`
   or equivalent — must not conflict with tenant token key in `web/`)
5. All subsequent platform requests use `Authorization: Bearer {cc_platform_token}`
6. On 401: clear token and redirect to CC login screen

### Platform API Client (Bootstrap)

```typescript
// command/lib/platform-api.ts
const PLATFORM_API_BASE = process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? '/api/platform/v1';

async function platformGet<T>(path: string): Promise<T> {
  const token = getPlatformToken(); // reads from storage
  const res = await fetch(`${PLATFORM_API_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });
  if (res.status === 401) {
    clearPlatformToken();
    window.location.href = '/login';
  }
  if (!res.ok) throw new Error(`Platform API error: ${res.status}`);
  return res.json();
}
```

### Admin User Context

```typescript
// command/context/AdminUserContext.tsx
interface AdminUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'support' | 'billing' | 'readonly';
}

interface AdminUserContextValue {
  adminUser: AdminUser | null;
  isLoading: boolean;
  logout: () => void;
}
```

### Navigation Shell

The Command Center uses a **dark sidebar shell** to visually distinguish it from
the tenant web admin. All screens share this shell after authentication.

See `NAVIGATION_SPEC.md` for the complete navigation structure.

### Role-Aware UI

Some Command Center screens show different actions based on the platform admin role:

- `super_admin` / `admin`: all CRUD actions, plan changes, feature flag mutations
- `support`: read-only views, support ticket management
- `billing`: read-only views, financial data, plan changes
- `readonly`: read-only across all sections

The UI must reflect these restrictions; the API enforces them as the primary layer.

---

## Build Sequence

Build CC-Web phases in order. Each phase depends on the previous.

1. **CC-Web Phase 1** — Auth, shell, overview dashboard (prerequisite for everything)
2. **CC-Web Phase 2** — Organisation management (highest operational value)
3. **CC-Web Phase 3** — Users, financials, support
4. **CC-Web Phase 4** — Automations, security, audit, settings

See `COMMAND_CENTER_PHASE_PROMPTS.md` for the detailed Claude Code prompt for each phase.

---

## Testing Requirements

Each CC-Web phase must include tests covering:

1. **Auth isolation** — platform token is rejected on tenant API routes; tenant token
   is rejected on platform API routes
2. **Role-based UI** — actions unavailable to certain roles are not rendered or are
   disabled with a clear reason
3. **Audit trail** — every mutation produces a `platform_audit_logs` entry
4. **Read-only correctness** — `readonly` admin role cannot submit any mutation
5. **Last-super-admin guard** — cannot remove or demote the final `super_admin`

---

## Environment Variables

The Command Center frontend requires:
NEXT_PUBLIC_PLATFORM_API_URL=https://api.wayfield.app/api/platform/v1
or in development:
NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:8000/api/platform/v1

This must be separate from any `NEXT_PUBLIC_API_URL` used by `web/`.