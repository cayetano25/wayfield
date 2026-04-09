# Multi-Tenant Architecture Model
## docs/02_domain/MULTI_TENANT_MODEL.md

**Source authority:** `MASTER_PROMPT.md` Product Principle 6.
Cross-tenant data leakage is a critical failure in this system.

---

## Core Rule

Every protected resource must be scoped by `organization_id`. Tenant isolation is
enforced at three independent layers: database queries, authorization policies, and
API middleware. Any single layer alone is insufficient.

---

## Tenant Boundaries

The `organizations` table is the root tenant entity. All data in the system is
ultimately owned by an organisation or is shared public data.

Data ownership hierarchy:
- `organizations` — root tenant entity
- `workshops` — belong to an `organization_id`
- `sessions` and `tracks` — belong to a workshop
- `registrations` and `session_selections` — belong to a workshop and user
- `leaders` via `organization_leaders` — associated to organisations (global entity;
  see Cross-Tenant Entities below)
- `notifications` — scoped to an `organization_id` and `workshop_id`
- `locations` — scoped to an `organization_id`
- `audit_logs` — scoped to an `organization_id`

---

## Cross-Tenant Entities

Some entities are global by design and may be associated with multiple organisations.
They are not tenant-isolated in storage, but access is enforced at the relationship level.

**`users`** — A user may belong to multiple organisations via separate `organization_users`
rows. Their membership in Organisation A gives them no access to Organisation B's data.
Policies always check the `organization_users` row for the specific org in context.

**`leaders`** — A leader profile may be associated with multiple organisations via
`organization_leaders`. Their `session_leaders` assignments are scoped to specific
sessions within specific organisations. A leader assigned to a session in Organisation A
must not access sessions in Organisation B.

---

## Platform Admin Exception

Wayfield's internal platform administrators (`admin_users`) can read tenant data across
all organisations for support and oversight purposes. This is the **only** permitted
cross-tenant access pattern.

Platform admins may **only mutate** tenant data through explicitly defined platform
endpoints:
- Feature flag overrides: `POST /api/platform/v1/organizations/{org}/feature-flags`
- Plan changes: `POST /api/platform/v1/organizations/{org}/billing/plan`
- System announcements: platform announcement endpoints

Every platform admin mutation is logged to `platform_audit_logs`. Platform admin tokens
are issued by the `auth:platform_admin` guard and are rejected on all `/api/v1/*` tenant
routes. Tenant tokens are rejected on all `/api/platform/v1/*` routes. The two identity
systems are completely isolated.

This exception is narrowly scoped. A platform admin reading Organisation B's data does
not grant Organisation B's users any access to that reading. Cross-organisation leakage
within the tenant system is still a critical failure regardless of platform admin access.

---

## Cross-Tenant Access Prohibition

Any access from tenant context that crosses organisation boundaries is a critical failure.

Prohibited examples:
- A user with `organization_users` access in Org A querying Org B's workshops
- A leader assigned to a session in Org A reading roster data from Org B
- A notification query that returns notifications from multiple organisations
- A report query that aggregates data across organisations

These must be caught by both:
1. Database query scoping (`WHERE organization_id = ?` on every relevant query)
2. Policy layer checks that confirm the resource's `organization_id` matches the
   organisation the user is authorised for

---

## Enforcement Layers

All three layers are required. No single layer is sufficient alone.

### Layer 1: Database Queries

Every query that retrieves tenant-scoped data must include an `organization_id` filter
or traverse a join chain that implicitly scopes by organisation. Query scopes
(`scopeForOrganization`) on Eloquent models are the recommended pattern.

Example:
```php
Workshop::forOrganization($organizationId)->findOrFail($id);
```

### Layer 2: Authorization Policies

Every Policy class for a tenant-scoped resource must verify that the resource's
`organization_id` matches the organisation the requesting user is a member of.
This catches cases where a valid user constructs a request to access another
org's resource by guessing an ID.

Example pattern in a Policy:
```php
public function view(User $user, Workshop $workshop): bool
{
    return $user->isMemberOf($workshop->organization_id);
}
```

### Layer 3: API Middleware

Route middleware must confirm that the authenticated user has an `organization_users`
row for the organisation identified in the route parameters before the request reaches
the controller. This prevents even the policy check from being reached by an
unauthorised user.

---

## Organization Model (Key Fields)

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `name` | VARCHAR NOT NULL | |
| `slug` | VARCHAR NOT NULL UNIQUE | URL-safe identifier |
| `primary_contact_first_name` | VARCHAR NOT NULL | |
| `primary_contact_last_name` | VARCHAR NOT NULL | |
| `primary_contact_email` | VARCHAR NOT NULL | |
| `primary_contact_phone` | VARCHAR nullable | |
| `status` | ENUM | `active`, `inactive`, `suspended` |
| `created_at`, `updated_at` | DATETIME | |

See `DATA_SCHEMA_FULL.md` Table 7 for the full schema.

---

## Audit Requirements

Log to `audit_logs` for:
- Organisation membership changes (member added, role changed, member removed)
- Ownership transfer
- Cross-organisation access attempts (where detectable)

Log to `platform_audit_logs` for:
- All platform admin mutations of tenant data (feature flags, plan changes, announcements)