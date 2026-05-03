# Wayfield Command Center
# Complete Implementation Guide with Claude Code Prompts
## docs/command_center/CC_IMPLEMENTATION_GUIDE_COMPLETE.md
## Version 1.0 — May 2026

---

## How to Use This Document

Each phase has two sessions: **API** (run in `wayfield/api`) and **Frontend**
(run in `wayfield/command`). Always complete the API session and verify it before
starting the frontend session. Never start a new phase until the previous one is
merged to main and all tests are green.

Each session opens with a complete, paste-ready Claude Code prompt. Git commands
are shown at each commit point and at the start and end of every phase.

**Work always happens in `wayfield/api` or `wayfield/command`. Never in `wayfield/web`.**

---

## Ground Rules — Read Before Every Session

These rules are stated in every prompt below. They are non-negotiable.

```
API RULES:
  Route prefix:   /api/platform/v1/        (NEVER /api/v1/platform/)
  Auth guard:     auth:platform_admin       (NEVER auth:sanctum on platform routes)
  Middleware:     platform.auth             (verifies AdminUser, checks is_active)
  Identity table: admin_users              (platform_admins is deprecated — ignore it)
  Audit table:    platform_audit_logs      (NEVER audit_logs — that is tenant-only)
  Audit service:  PlatformAuditService::record() on every mutation — no exceptions
  Tenant token → 403 on any platform route
  Platform token → 403 on any tenant route

FRONTEND RULES:
  API base:    NEXT_PUBLIC_PLATFORM_API_URL    (NEVER NEXT_PUBLIC_API_URL)
  Token key:   cc_platform_token              (NEVER same key as web/ tenant token)
  UI libs:     Tailwind CSS + recharts + lucide-react ONLY
               NO @tremor/react, NO shadcn/ui, NO Radix, NO Headless UI
  Shell:       Dark sidebar (#111827) + light content area (#F9FAFB)
  HIG:         44px min touch targets, focus-visible rings, loading/empty/error on every screen
  Fonts:       Sora (headings), Plus Jakarta Sans (body), JetBrains Mono (data)

PLAN NAMES:
  DB code → Display name → Price → CC badge color
  free       → Foundation  → $0         → gray
  starter    → Creator     → $49/mo     → teal
  pro        → Studio      → $149/mo    → orange
  enterprise → Enterprise  → Custom     → purple
  ALWAYS use display names in the UI. DB codes only for API calls and DB queries.

PAYMENT FLAGS (two-level architecture):
  payments_enabled (platform scope) — global kill switch, starts FALSE
  org_payments_enabled (org scope) — per-org toggle, must be explicitly enabled
  Both must be TRUE + Stripe charges_enabled for payments to work
```

---

## Phase Map

| Phase | API Branch | Frontend Branch | Contents |
|-------|-----------|----------------|---------|
| Pre-flight | — | — | Diagnostic — run first |
| Remediation | `cc/fix-route-prefix` | — | Fix wrong route prefix in api.php |
| 0 | `cc/phase-0-api` | `cc/phase-0-frontend` | Auth, guard, audit infra, overview |
| 1 | `cc/phase-1-api` | `cc/phase-1-frontend` | Org management, feature flags |
| 2 | `cc/phase-2-api` | `cc/phase-2-frontend` | Users, financials, payment controls |
| 3 | `cc/phase-3-api` | `cc/phase-3-frontend` | Automations, security, settings |
| 4 | `cc/phase-4-api` | `cc/phase-4-frontend` | Support tickets + AI |

---

## Pre-Flight Diagnostic

**Run in:** `cd wayfield/api && claude`
**Branch:** Stay on main — no branch needed, no code written.

```
You are running a pre-flight diagnostic for the Wayfield Command Center build.
Do not write any application code. Only run commands and report the full output.

Run each check and report the exact output. Do not interpret or summarise —
paste the raw output so the results can be reviewed before any build work begins.

CHECK 1 — admin_users table
  php artisan tinker --execute="echo Schema::hasTable('admin_users') ? 'EXISTS' : 'MISSING';"

CHECK 2 — AdminUser model and HasApiTokens
  cat app/Models/AdminUser.php 2>/dev/null || echo "FILE NOT FOUND"

CHECK 3 — platform_admin guard in config/auth.php
  php artisan tinker --execute="echo array_key_exists('platform_admin', config('auth.guards')) ? 'EXISTS' : 'MISSING';"

CHECK 4 — EnsurePlatformToken middleware
  cat app/Http/Middleware/EnsurePlatformToken.php 2>/dev/null || echo "FILE NOT FOUND"

CHECK 5 — routes/platform.php
  cat routes/platform.php 2>/dev/null || echo "FILE NOT FOUND"

CHECK 6 — platform routes registered (check for wrong prefix)
  php artisan route:list | grep -i platform

CHECK 7 — platform_audit_logs table
  php artisan tinker --execute="echo Schema::hasTable('platform_audit_logs') ? 'EXISTS' : 'MISSING';"

CHECK 8 — PlatformAuditService
  cat app/Services/Platform/PlatformAuditService.php 2>/dev/null || echo "FILE NOT FOUND"

CHECK 9 — payment_feature_flags table
  php artisan tinker --execute="echo Schema::hasTable('payment_feature_flags') ? 'EXISTS' : 'MISSING';"

CHECK 10 — stripe_connect_accounts table
  php artisan tinker --execute="echo Schema::hasTable('stripe_connect_accounts') ? 'EXISTS' : 'MISSING';"

CHECK 11 — platform_take_rates table
  php artisan tinker --execute="echo Schema::hasTable('platform_take_rates') ? 'EXISTS' : 'MISSING';"

CHECK 12 — feature_flags and organization_feature_flags tables
  php artisan tinker --execute="
    echo 'feature_flags: '.(Schema::hasTable('feature_flags')?'EXISTS':'MISSING').PHP_EOL;
    echo 'org_feature_flags: '.(Schema::hasTable('organization_feature_flags')?'EXISTS':'MISSING').PHP_EOL;"

CHECK 13 — support tables
  php artisan tinker --execute="
    foreach(['support_tickets','support_messages','support_ai_suggestions',
             'support_escalations','ai_knowledge_sources','ai_action_logs'] as \$t)
      echo \$t.': '.(Schema::hasTable(\$t)?'EXISTS':'MISSING').PHP_EOL;"

CHECK 14 — system_announcements and platform_config
  php artisan tinker --execute="
    echo 'system_announcements: '.(Schema::hasTable('system_announcements')?'EXISTS':'MISSING').PHP_EOL;
    echo 'platform_config: '.(Schema::hasTable('platform_config')?'EXISTS':'MISSING').PHP_EOL;"

CHECK 15 — first admin user exists
  php artisan tinker --execute="
    use App\Models\AdminUser;
    echo 'Admin users: '.AdminUser::count().PHP_EOL;
    echo 'Super admins: '.AdminUser::where('role','super_admin')->count().PHP_EOL;"

Report all results. Do not proceed to any phase until this diagnostic is complete.
```

---

## Route Prefix Remediation

**Only run this if CHECK 6 shows routes at `/api/v1/platform/*`.**
If all platform routes are already at `/api/platform/v1/*`, skip to Phase 0.

```bash
cd wayfield/api
git checkout main && git pull
git checkout -b cc/fix-route-prefix
```

**Run in:** `cd wayfield/api && claude`

```
You are fixing a route prefix error in the Wayfield Command Center API.

The bulk of the CC API routes are at the WRONG prefix:
  WRONG:   /api/v1/platform/*
  CORRECT: /api/platform/v1/*

The auth endpoints may already be correct. Verify before touching them.

═══════════════════════════════════════════════════════════
STEP 1 — AUDIT CURRENT STATE (read only — no changes yet)
═══════════════════════════════════════════════════════════

Run and report ALL output:

  php artisan route:list | grep -i platform
  sed -n '560,630p' routes/api.php
  cat routes/platform.php 2>/dev/null || echo "NOT FOUND"
  grep -rn "v1/platform\|api/v1/platform" tests/ | grep "\.php"

Do not write any code until you have reported these results.

═══════════════════════════════════════════════════════════
STEP 2 — MOVE ROUTES TO CORRECT PREFIX
═══════════════════════════════════════════════════════════

Ensure routes/platform.php exists and is registered.
Move all wrongly-prefixed routes from routes/api.php to routes/platform.php.
All platform routes must live under prefix 'api/platform/v1'.
Remove the old block from routes/api.php entirely — no stub, no comment, no redirect.

Verify no duplicates:
  php artisan route:list | grep platform
Each platform route must appear exactly once.

═══════════════════════════════════════════════════════════
STEP 3 — UPDATE ALL AFFECTED TESTS
═══════════════════════════════════════════════════════════

Find every test referencing the old prefix:
  grep -rn "api/v1/platform" tests/

Replace every instance:
  OLD: /api/v1/platform/
  NEW: /api/platform/v1/

Verify zero occurrences remain:
  grep -rn "api/v1/platform" tests/

═══════════════════════════════════════════════════════════
STEP 4 — VERIFY AND TEST
═══════════════════════════════════════════════════════════

Run the full test suite:
  ./vendor/bin/pest

All tests must be green. Fix any failures before committing.

Manual verification (run these curl checks):
  # Old prefix must return 404
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/platform/overview
  # Expected: 404

  # New prefix must return 401 (route exists, just needs auth)
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/platform/v1/overview
  # Expected: 401

  # No platform routes at wrong location
  php artisan route:list | grep "v1/platform"
  # Expected: zero rows

Commit only after all tests pass and all three manual checks pass.
```

```bash
git add routes/api.php routes/platform.php bootstrap/app.php tests/
git commit -m "fix(cc-api): move platform routes to canonical /api/platform/v1/* prefix"
git push origin cc/fix-route-prefix
# Open PR → merge to main
git checkout main && git pull
```

---

# PHASE 0
# Foundation: Auth, Guard, Audit Infrastructure, Overview

---

## Phase 0 — API

```bash
cd wayfield/api
git checkout main && git pull
git checkout -b cc/phase-0-api
```

**Run in:** `cd wayfield/api && claude`

```
You are building the Wayfield Command Center API foundation.
The Command Center is completely separate from the tenant web admin.
All platform routes use /api/platform/v1/ and auth:platform_admin guard.
Tenant tokens return 403 on all platform routes. Platform tokens return 403
on all tenant routes. This is enforced by middleware, never by convention.

Read before writing:
@../docs/command_center/COMMAND_CENTER_OVERVIEW.md
@../docs/command_center/COMMAND_CENTER_SCHEMA.md

For every task: CHECK IF IT ALREADY EXISTS before creating.
If a file or table already has the needed functionality: SKIP and note it.
Never overwrite working code without reading what is there first.

═══════════════════════════════════════════════════════════
TASK 1 — VERIFY OR CREATE: admin_users TABLE
═══════════════════════════════════════════════════════════

Run: php artisan tinker --execute="echo Schema::hasTable('admin_users') ? 'EXISTS' : 'MISSING';"

If EXISTS: verify columns match — id, first_name, last_name, email, password,
role ENUM(super_admin,admin,support,billing,readonly), is_active, email_verified_at,
last_login_at, created_at, updated_at. If adequate: skip to Task 2.

If MISSING or columns incomplete, create migration create_admin_users_table:
  Schema::create('admin_users', function (Blueprint $table) {
    $table->id();
    $table->string('first_name', 100);
    $table->string('last_name', 100);
    $table->string('email', 255)->unique();
    $table->string('password', 255);
    $table->enum('role', ['super_admin','admin','support','billing','readonly'])
          ->default('support');
    $table->boolean('is_active')->default(true);
    $table->dateTime('email_verified_at')->nullable();
    $table->dateTime('last_login_at')->nullable();
    $table->timestamps();
    $table->index(['role', 'is_active']);
  });
  php artisan migrate

git add . && git commit -m "feat(cc-phase0-task1): verify or create admin_users table"

═══════════════════════════════════════════════════════════
TASK 2 — VERIFY OR CREATE: AdminUser MODEL
═══════════════════════════════════════════════════════════

Check: cat app/Models/AdminUser.php

If it exists with HasApiTokens, $table='admin_users', role CONSTANTS, fullName(): skip.

If missing or incomplete, create app/Models/AdminUser.php:

<?php
declare(strict_types=1);
namespace App\Models;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class AdminUser extends Authenticatable
{
    use HasApiTokens;
    protected $table = 'admin_users';
    protected $fillable = ['first_name','last_name','email','password','role','is_active'];
    protected $hidden = ['password','remember_token'];
    protected $casts = [
        'is_active' => 'boolean',
        'email_verified_at' => 'datetime',
        'last_login_at' => 'datetime',
    ];
    public const ROLES = ['super_admin','admin','support','billing','readonly'];
    public const MUTATING_ROLES = ['super_admin','admin','billing'];
    public function canMutate(): bool {
        return in_array($this->role, self::MUTATING_ROLES, true);
    }
    public function fullName(): string {
        return trim("{$this->first_name} {$this->last_name}");
    }
}

git add . && git commit -m "feat(cc-phase0-task2): verify or create AdminUser model"

═══════════════════════════════════════════════════════════
TASK 3 — VERIFY OR CREATE: PLATFORM GUARD
═══════════════════════════════════════════════════════════

Check: php artisan tinker --execute="echo array_key_exists('platform_admin', config('auth.guards')) ? 'EXISTS' : 'MISSING';"

If EXISTS and provider points to admin_users/AdminUser: skip.

If MISSING, add to config/auth.php:
  Under 'guards':
    'platform_admin' => ['driver' => 'sanctum', 'provider' => 'admin_users'],
  Under 'providers':
    'admin_users' => ['driver' => 'eloquent', 'model' => App\Models\AdminUser::class],

Verify: php artisan tinker --execute="echo config('auth.guards.platform_admin.provider');"
Expected: admin_users

git add . && git commit -m "feat(cc-phase0-task3): verify or create platform_admin guard"

═══════════════════════════════════════════════════════════
TASK 4 — VERIFY OR CREATE: EnsurePlatformToken MIDDLEWARE
═══════════════════════════════════════════════════════════

Check: cat app/Http/Middleware/EnsurePlatformToken.php

If it exists, checks instanceof AdminUser, and checks is_active: skip.

If missing, create app/Http/Middleware/EnsurePlatformToken.php:

<?php
declare(strict_types=1);
namespace App\Http\Middleware;
use App\Models\AdminUser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlatformToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user instanceof AdminUser) {
            return response()->json([
                'error' => 'platform_auth_required',
                'message' => 'This endpoint requires a platform admin token.',
            ], 403);
        }
        if (!$user->is_active) {
            return response()->json([
                'error' => 'account_inactive',
                'message' => 'This admin account has been deactivated.',
            ], 403);
        }
        return $next($request);
    }
}

Register alias 'platform.auth' in bootstrap/app.php (Laravel 11) or Kernel.php (Laravel 10).

git add . && git commit -m "feat(cc-phase0-task4): verify or create EnsurePlatformToken middleware"

═══════════════════════════════════════════════════════════
TASK 5 — VERIFY OR CREATE: routes/platform.php
═══════════════════════════════════════════════════════════

Check: ls routes/platform.php 2>/dev/null && echo "EXISTS" || echo "MISSING"

If it exists with the correct prefix api/platform/v1: skip.

If missing, create routes/platform.php:

<?php
declare(strict_types=1);
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Platform\PlatformAuthController;
use App\Http\Controllers\Api\Platform\OverviewController;

Route::prefix('api/platform/v1')->group(function () {
    // Public: no auth on login
    Route::post('/auth/login', [PlatformAuthController::class, 'login']);

    // All other platform routes require platform admin auth
    Route::middleware(['auth:platform_admin', 'platform.auth'])->group(function () {
        Route::post('/auth/logout', [PlatformAuthController::class, 'logout']);
        Route::get('/me', [PlatformAuthController::class, 'me']);
        Route::get('/overview', [OverviewController::class, 'index']);
        // Additional routes added per phase below this line
    });
});

Register in bootstrap/app.php so this file is loaded with 'api' middleware:
  ->withRouting(function (Router $router) {
      // existing routes...
      $router->middleware('api')->group(base_path('routes/platform.php'));
  })

Verify: php artisan route:list | grep platform
Expected: login, logout, me, overview routes all at /api/platform/v1/*

git add . && git commit -m "feat(cc-phase0-task5): verify or create platform routes file"

═══════════════════════════════════════════════════════════
TASK 6 — CREATE: platform_audit_logs TABLE
═══════════════════════════════════════════════════════════

Check: php artisan tinker --execute="echo Schema::hasTable('platform_audit_logs') ? 'EXISTS' : 'MISSING';"

If EXISTS with adequate columns: skip.

If MISSING, create migration create_platform_audit_logs_table:
  Schema::create('platform_audit_logs', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('admin_user_id')->nullable();
    $table->unsignedBigInteger('organization_id')->nullable();
    $table->string('action', 100);
    $table->string('entity_type', 100)->nullable();
    $table->unsignedBigInteger('entity_id')->nullable();
    $table->json('old_value_json')->nullable();
    $table->json('new_value_json')->nullable();
    $table->json('metadata_json')->nullable();
    $table->dateTime('created_at'); // No updated_at — logs are immutable
    $table->index('admin_user_id');
    $table->index('organization_id');
    $table->index('action');
    $table->index('created_at');
  });
  php artisan migrate

Note: NO updated_at. Audit entries are immutable — never UPDATE or DELETE rows.

git add . && git commit -m "feat(cc-phase0-task6): create platform_audit_logs table"

═══════════════════════════════════════════════════════════
TASK 7 — CREATE: system_announcements TABLE
═══════════════════════════════════════════════════════════

Check: php artisan tinker --execute="echo Schema::hasTable('system_announcements') ? 'EXISTS' : 'MISSING';"

If EXISTS: skip.

If MISSING, create migration create_system_announcements_table:
  Schema::create('system_announcements', function (Blueprint $table) {
    $table->id();
    $table->string('title', 255);
    $table->text('message');
    $table->enum('type', ['info','warning','critical'])->default('info');
    $table->boolean('is_active')->default(true);
    $table->dateTime('starts_at')->nullable();
    $table->dateTime('ends_at')->nullable();
    $table->unsignedBigInteger('created_by_admin_user_id')->nullable();
    $table->timestamps();
    $table->index('is_active');
  });
  php artisan migrate

git add . && git commit -m "feat(cc-phase0-task7): create system_announcements table"

═══════════════════════════════════════════════════════════
TASK 8 — CREATE: PlatformAuditService
═══════════════════════════════════════════════════════════

Check: cat app/Services/Platform/PlatformAuditService.php 2>/dev/null || echo "NOT FOUND"

If it exists with record() writing to platform_audit_logs: skip.

If missing, create app/Services/Platform/PlatformAuditService.php:

<?php
declare(strict_types=1);
namespace App\Services\Platform;
use App\Models\AdminUser;
use Illuminate\Support\Facades\DB;

class PlatformAuditService
{
    public static function record(
        AdminUser $adminUser,
        string $action,
        ?string $entityType = null,
        ?int $entityId = null,
        mixed $oldValue = null,
        mixed $newValue = null,
        array $metadata = [],
        ?int $organizationId = null,
    ): void {
        DB::table('platform_audit_logs')->insert([
            'admin_user_id'   => $adminUser->id,
            'organization_id' => $organizationId,
            'action'          => $action,
            'entity_type'     => $entityType,
            'entity_id'       => $entityId,
            'old_value_json'  => $oldValue !== null ? json_encode($oldValue) : null,
            'new_value_json'  => $newValue !== null ? json_encode($newValue) : null,
            'metadata_json'   => !empty($metadata) ? json_encode($metadata) : null,
            'created_at'      => now(),
        ]);
    }
}

git add . && git commit -m "feat(cc-phase0-task8): create PlatformAuditService"

═══════════════════════════════════════════════════════════
TASK 9 — CREATE: PlatformAuthController
═══════════════════════════════════════════════════════════

Create app/Http/Controllers/Api/Platform/PlatformAuthController.php:

Methods: login, logout, me

login():
  Validate: { email: required|email, password: required }
  Find AdminUser where email = input AND is_active = true
  If not found or password wrong: throw ValidationException
  Update last_login_at = now()
  Revoke all existing tokens (admin->tokens()->delete())
  Create new token: $admin->createToken('cc-platform-token')->plainTextToken
  Return 200: { token, admin_user: { id, first_name, last_name, email, role } }

logout():
  $request->user()->currentAccessToken()->delete()
  Return 200: { message: 'Logged out.' }

me():
  $admin = $request->user()
  Return 200: { id, first_name, last_name, email, role, last_login_at (ISO8601) }

git add . && git commit -m "feat(cc-phase0-task9): create PlatformAuthController"

═══════════════════════════════════════════════════════════
TASK 10 — CREATE: OverviewController
═══════════════════════════════════════════════════════════

Create app/Http/Controllers/Api/Platform/OverviewController.php

GET /api/platform/v1/overview

Queries (use Schema::hasTable() guard for tables that may not exist yet):
  organizations: total count, count by status (active/suspended/inactive)
  subscriptions: count by plan_code (if table exists — guard with hasTable)
  users: total, active last 30 days (last_login_at >= now-30days), new last 7 days
  workshops: total, published count, draft count
  platform_audit_logs: last 10 entries joined with admin_users for name,
    joined with organizations for org name

Response:
{
  "organizations": {
    "total": int, "active": int, "suspended": int, "inactive": int,
    "by_plan": { "free": int, "starter": int, "pro": int, "enterprise": int }
  },
  "users": { "total": int, "active_30_days": int, "new_7_days": int },
  "workshops": { "total": int, "published": int, "draft": int },
  "mrr_cents": null,
  "recent_audit_events": [
    { "admin_name": string, "action": string, "organization_name": string|null, "created_at": string }
  ],
  "generated_at": ISO8601
}

git add . && git commit -m "feat(cc-phase0-task10): create overview endpoint"

═══════════════════════════════════════════════════════════
TASK 11 — SEED: FIRST SUPER ADMIN
═══════════════════════════════════════════════════════════

Check if super_admin exists:
  php artisan tinker --execute="
    use App\Models\AdminUser;
    echo AdminUser::where('role','super_admin')->count() > 0 ? 'EXISTS' : 'MISSING';"

If EXISTS: skip.

If MISSING, create database/seeders/PlatformAdminSeeder.php:

<?php
declare(strict_types=1);
namespace Database\Seeders;
use App\Models\AdminUser;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class PlatformAdminSeeder extends Seeder
{
    public function run(): void
    {
        if (AdminUser::where('role', 'super_admin')->exists()) {
            $this->command->info('Super admin already exists — skipping.');
            return;
        }
        AdminUser::create([
            'first_name' => 'Wayfield',
            'last_name'  => 'Admin',
            'email'      => env('PLATFORM_ADMIN_EMAIL', 'admin@wayfieldapp.com'),
            'password'   => Hash::make(env('PLATFORM_ADMIN_PASSWORD', 'changeme-immediately')),
            'role'       => 'super_admin',
            'is_active'  => true,
        ]);
        $this->command->info('✓ Super admin created. Change the password immediately.');
    }
}

Add to .env and .env.example:
  PLATFORM_ADMIN_EMAIL=admin@wayfieldapp.com
  PLATFORM_ADMIN_PASSWORD=changeme-immediately

Run: php artisan db:seed --class=PlatformAdminSeeder

git add . && git commit -m "feat(cc-phase0-task11): add platform admin seeder and create first super admin"

═══════════════════════════════════════════════════════════
TASK 12 — TESTS: PHASE 0 API
═══════════════════════════════════════════════════════════

Create tests/Feature/Platform/PlatformAuthTest.php:
  - POST /api/platform/v1/auth/login valid credentials → 200 + token + admin_user shape
  - POST /api/platform/v1/auth/login wrong password → 422
  - POST /api/platform/v1/auth/login inactive admin → 422
  - POST /api/platform/v1/auth/login with a TENANT user email → 422
  - GET /api/platform/v1/me with valid platform token → 200 + correct shape
  - GET /api/platform/v1/me with tenant sanctum token → 403
  - GET /api/platform/v1/me unauthenticated → 401
  - POST /api/platform/v1/auth/logout → 200, subsequent /me returns 401

Create tests/Feature/Platform/OverviewTest.php:
  - GET /api/platform/v1/overview with platform token → 200 + correct shape
  - GET /api/platform/v1/overview with tenant token → 403
  - GET /api/platform/v1/overview unauthenticated → 401
  - Response contains organizations, users, workshops, generated_at keys

Run: ./vendor/bin/pest tests/Feature/Platform/
All tests must be green before committing.

git add . && git commit -m "feat(cc-phase0-task12): phase 0 API tests"
```

**Merge Phase 0 API:**
```bash
git push origin cc/phase-0-api
# Open PR → merge to main
git checkout main && git pull
```

**Verify before starting frontend:**
```bash
# Login check — should return 200 with token
curl -s -X POST http://localhost:8000/api/platform/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@wayfieldapp.com","password":"changeme-immediately"}' \
  | python3 -m json.tool

# Save the token from above, then check /me
curl -s http://localhost:8000/api/platform/v1/me \
  -H "Authorization: Bearer {your-token-here}" \
  | python3 -m json.tool

# Overview check
curl -s http://localhost:8000/api/platform/v1/overview \
  -H "Authorization: Bearer {your-token-here}" \
  | python3 -m json.tool
```

---

## Phase 0 — Frontend

```bash
cd wayfield/command
git checkout main && git pull
git checkout -b cc/phase-0-frontend
```

**Run in:** `cd wayfield/command && claude`

```
You are building the Wayfield Command Center frontend foundation: login screen,
persistent dark shell, and overview dashboard.

Work directory: wayfield/command/ ONLY. Never touch wayfield/web/.

Read before writing:
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md

NON-NEGOTIABLE RULES:
  API base:    NEXT_PUBLIC_PLATFORM_API_URL (NEVER NEXT_PUBLIC_API_URL)
  Token key:   'cc_platform_token'
  No @tremor/react. No shadcn/ui. No Radix.
  Charts: recharts only. Icons: lucide-react only.
  Dark sidebar #111827. Light content #F9FAFB.
  44px minimum touch targets. focus-visible rings. Full loading/empty/error states.
  Fonts: Sora (headings), Plus Jakarta Sans (body), JetBrains Mono (data).

PLAN DISPLAY NAMES (use in all UI):
  free → Foundation, starter → Creator, pro → Studio, enterprise → Enterprise

═══════════════════════════════════════════════════════════
PART 1 — FOUNDATION
═══════════════════════════════════════════════════════════

1A. FONTS — app/layout.tsx
  Import: Sora, Plus_Jakarta_Sans, JetBrains_Mono from next/font/google
  CSS vars: --font-heading (Sora), --font-sans (Plus Jakarta Sans), --font-mono (JetBrains Mono)
  Apply all three to <html> className

1B. TAILWIND — tailwind.config.ts
  fontFamily: {
    heading: ['var(--font-heading)', 'sans-serif'],
    sans:    ['var(--font-sans)',    'sans-serif'],
    mono:    ['var(--font-mono)',    'monospace'],
  }

1C. API CLIENT — lib/platform-api.ts
  const TOKEN_KEY = 'cc_platform_token'
  const BASE = process.env.NEXT_PUBLIC_PLATFORM_API_URL
  Export: platformApi.get/post/put/patch/delete
  Export: getPlatformToken, setPlatformToken, clearPlatformToken
  On 401: clearPlatformToken() + window.location.href = '/login'
  On 403: throw error (do not redirect to login — role issue, not auth issue)

1D. ADMIN USER CONTEXT — context/AdminUserContext.tsx
  AdminRole = 'super_admin'|'admin'|'support'|'billing'|'readonly'
  AdminUser: { id, first_name, last_name, email, role }
  AdminUserProvider: on mount GET /me, set user or clear token on error
  useAdminUser() hook
  can object:
    manageBilling:      ['super_admin','billing']
    manageFeatureFlags: ['super_admin','admin']
    viewUsers:          ['super_admin','admin','support']
    viewFinancials:     ['super_admin','billing']
    viewSupport:        ['super_admin','admin','support']
    manageAutomations:  ['super_admin','admin']
    viewSecurity:       ['super_admin','admin','support']
    viewAuditLog:       ['super_admin','admin']
    manageSettings:     ['super_admin']
    managePayments:     ['super_admin','billing']
    manageTakeRates:    ['super_admin']

1E. ROOT LAYOUT — app/layout.tsx
  Wrap with <AdminUserProvider>. Set lang="en".

1F. ENV FILE — .env.local.example
  NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:8000/api/platform/v1
  NEXT_PUBLIC_SUPPORT_TOOL_URL=https://your-support-tool.com

git add . && git commit -m "feat(cc-web-phase0-part1): foundation — api client, context, fonts"

═══════════════════════════════════════════════════════════
PART 2 — LOGIN SCREEN
═══════════════════════════════════════════════════════════

Route: /login (public — no sidebar)
File: app/login/page.tsx
API: POST /api/platform/v1/auth/login
Request: { email, password }
Success: { token, admin_user }

FULL VIEWPORT DARK (#111827):
  Centered column, items-center, justify-center, min-h-screen

ABOVE CARD:
  "WAYFIELD" — Sora 18px font-bold text-white mb-1
  "Command Center" — JetBrains Mono 11px text-gray-400 uppercase tracking-widest mb-8

CARD (bg-white rounded-2xl shadow-2xl max-w-sm w-full px-8 py-10):
  H1 "Sign in" — Sora 24px font-semibold text-gray-900 mb-1
  "Platform administrator access only" — Plus Jakarta Sans 14px text-gray-500 mb-6

  Email input (mt-0):
    Label "Email address" (13px gray-700 mb-1)
    type="email" autocomplete="email"
    h-[44px] w-full border border-gray-200 rounded-lg px-4 text-sm
    focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent

  Password input (mt-4): same style, type="password", autocomplete="current-password"

  Error area (mt-3 min-h-[20px]):
    If error: flex items-center gap-2
    AlertCircle (lucide 14px text-red-500) + text-sm text-red-600
    "Invalid email or password." | "Connection error. Please check your network."

  Sign in button (mt-6):
    bg-[#0FA3B1] text-white w-full h-[44px] rounded-lg text-sm font-medium
    hover:bg-[#0d8f9c] focus-visible:ring-2 focus-visible:ring-[#0FA3B1] focus-visible:outline-none
    Loading: Loader2 icon animate-spin 16px + "Signing in..." text, disabled=true

ON SUCCESS: setPlatformToken(token), setAdminUser(admin_user), router.replace('/')
ON ERROR: show inline error message, no redirect
If already has valid token (getPlatformToken() && /me returns 200): redirect('/') immediately

git add . && git commit -m "feat(cc-web-phase0-part2): login screen"

═══════════════════════════════════════════════════════════
PART 3 — DARK SHELL: SIDEBAR + TOP BAR + AUTHENTICATED LAYOUT
═══════════════════════════════════════════════════════════

Files:
  app/(admin)/layout.tsx
  components/Sidebar.tsx
  components/TopBar.tsx
  components/RoleBadge.tsx

AUTHENTICATED LAYOUT (app/(admin)/layout.tsx):
  On mount: check adminUser after loading. If null → redirect('/login').
  Loading: render <div className="min-h-screen bg-gray-900" /> (no flash)
  Structure:
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <div className="flex flex-1 pt-14"> {/* 56px = h-14 */}
        <Sidebar />
        <main className="flex-1 ml-56 bg-gray-50 overflow-y-auto">
          <div className="px-8 py-8">{children}</div>
        </main>
      </div>
    </div>

TOP BAR (components/TopBar.tsx):
  fixed top-0 left-0 right-0 h-14 z-30 bg-gray-900 flex items-center px-4
  Left: small teal square 10px + gap-2 +
    "WAYFIELD" (Sora 14px font-bold white) + mx-3 "·" (text-gray-600) +
    "Command Center" (JetBrains Mono 11px text-gray-400 uppercase tracking-widest)
  Right: flex items-center gap-3 ml-auto
    Admin fullName (Plus Jakarta Sans 14px white)
    <RoleBadge role={adminUser.role} />
    Sign out button (Plus Jakarta Sans 13px text-gray-400 hover:text-white
      transition-colors cursor-pointer min-h-[44px] px-3 flex items-center)
  Sign out: platformApi.post('/auth/logout').catch(()=>{}), clearPlatformToken(),
    setAdminUser(null), router.replace('/login')

ROLE BADGE (components/RoleBadge.tsx):
  Pill: JetBrains Mono text-[10px] uppercase font-medium rounded-full border px-2 py-0.5
  Labels: super_admin→"SUPER ADMIN", admin→"ADMIN", support→"SUPPORT",
    billing→"BILLING", readonly→"READ ONLY"
  Colors:
    super_admin: bg-[#E94F37]/15 text-[#E94F37] border-[#E94F37]/30
    admin:       bg-blue-500/15  text-blue-500  border-blue-500/30
    support:     bg-purple-500/15 text-purple-500 border-purple-500/30
    billing:     bg-[#E67E22]/15 text-[#E67E22] border-[#E67E22]/30
    readonly:    bg-gray-500/15  text-gray-400  border-gray-500/30

SIDEBAR (components/Sidebar.tsx):
  fixed left-0 top-0 w-56 h-full z-20 bg-gray-900 overflow-hidden
  px-3 pt-16 pb-6 flex flex-col

  LOGO AREA (mb-6):
    "WAYFIELD" Sora 15px font-bold white
    "Command Center" JetBrains Mono 10px text-gray-500 uppercase tracking-widest

  NAV ITEMS (flex-1):
    Built dynamically. Items filtered by role using can helpers.
    usePathname() detects active route.

    Active item:  border-l-2 border-[#0FA3B1] bg-[#0FA3B1]/10 text-white pl-[14px] ml-[-12px]
    Inactive item: text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors pl-3

    Item: h-10 flex items-center gap-3 rounded-lg text-sm cursor-pointer (min touch: w-full)
    Icon: size={18}
    Divider between groups: <div className="my-3 border-t border-gray-800" />

    GROUP 1 (always visible):
      { href:'/',              icon:LayoutDashboard, label:'Overview' }
      { href:'/organizations', icon:Building2,        label:'Organisations' }
      if can.viewUsers:      { href:'/users',         icon:Users,          label:'Users' }
      if can.viewFinancials: { href:'/financials',    icon:CreditCard,     label:'Financials' }
      if can.viewSupport:    { href:'/support',       icon:MessageCircle,  label:'Support' }

    DIVIDER

    GROUP 2 (role-gated):
      if can.manageAutomations:{ href:'/automations', icon:Zap,            label:'Automations' }
      if can.viewSecurity:     { href:'/security',    icon:Shield,         label:'Security' }
      if can.viewAuditLog:     { href:'/audit',       icon:ClipboardList,  label:'Audit Log' }
      if role==='super_admin'||role==='admin': { href:'/announcements', icon:Megaphone, label:'Announcements' }
      if can.manageSettings:   { href:'/settings',   icon:Settings,       label:'Settings' }

  BOTTOM (mt-auto):
    <RoleBadge role={adminUser.role} />
    Admin fullName (Plus Jakarta Sans 11px text-gray-500 mt-1)

git add . && git commit -m "feat(cc-web-phase0-part3): dark sidebar shell and top bar"

═══════════════════════════════════════════════════════════
PART 4 — OVERVIEW DASHBOARD
═══════════════════════════════════════════════════════════

File: app/(admin)/page.tsx
API: GET /api/platform/v1/overview

Shared components to create first:
  components/ui/StatCard.tsx — label (font-mono uppercase), value (font-heading 3xl bold),
    subtitle (text-sm gray-500), alertLevel prop (none|warning|error changes border/bg)
  components/ui/SkeletonCard.tsx — animate-pulse bg-gray-200 rounded-xl at specified height

PAGE HEADER:
  H1 "Overview" (font-heading text-2xl font-semibold text-gray-900)
  Subtitle "Platform health at a glance" (font-sans text-sm text-gray-500 mt-1)
  RefreshCw button top-right (min-h-[44px] min-w-[44px], animate-spin while refreshing)

LOADING STATE: 4 SkeletonCard h-28 + 2 SkeletonCard h-64

ROW 1 — 4 STAT CARDS (grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6):
  1. label="ORGANISATIONS"  value={data.organizations.total}
     subtitle="{data.organizations.active} active"
  2. label="ACTIVE USERS"   value={data.users.active_30_days}
     subtitle="+{data.users.new_7_days} new this week"
  3. label="WORKSHOPS"      value={data.workshops.published}
     subtitle="{data.workshops.draft} in draft"
  4. label="MRR"
     value={data.mrr_cents ? "$" + (data.mrr_cents/100).toFixed(2) : "—"}
     subtitle={data.mrr_cents ? "from active subscriptions"
               : "Stripe webhook not connected"}
     alertLevel={!data.mrr_cents ? 'warning' : 'none'}

ROW 2 — 2 PANELS (grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4):

LEFT — Plan Distribution (bg-white rounded-xl border border-gray-200 shadow-sm p-6):
  H2 "Organisations by Plan" (font-heading text-base font-semibold gray-900 mb-4)
  recharts PieChart (donut), height 220, ResponsiveContainer:
    Data uses DISPLAY NAMES:
    [
      { name:'Foundation', value:data.organizations.by_plan.free,       fill:'#9CA3AF' },
      { name:'Creator',    value:data.organizations.by_plan.starter,    fill:'#0FA3B1' },
      { name:'Studio',     value:data.organizations.by_plan.pro,        fill:'#E67E22' },
      { name:'Enterprise', value:data.organizations.by_plan.enterprise, fill:'#8B5CF6' },
    ]
    innerRadius=60 outerRadius=90
  Legend below: colored dot 10px + name + count (flex row, gap-4, flex-wrap, mt-4)
  If all counts 0: "No organisations yet" text-gray-400 text-sm py-8 text-center

RIGHT — Recent Activity (bg-white rounded-xl border border-gray-200 shadow-sm p-6):
  H2 "Recent Platform Activity" (font-heading text-base font-semibold gray-900 mb-4)
  List recent_audit_events (up to 10):
    Each row (py-3 border-b border-gray-50 last:border-0 flex items-start justify-between):
      Left: admin_name (font-sans text-sm gray-900) +
        action (font-mono text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded ml-2)
        org_name below (font-sans text-xs gray-400) if present
      Right: relative timestamp (font-mono text-xs gray-400)
  If empty: "No recent platform activity." text-gray-400 text-sm py-8 text-center

ERROR STATE: bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3
  AlertTriangle (red-500 16px) + "Failed to load overview data." + "Retry" button min-h-[44px]

git add . && git commit -m "feat(cc-web-phase0-part4): overview dashboard"

═══════════════════════════════════════════════════════════
PART 5 — TESTS: PHASE 0 FRONTEND
═══════════════════════════════════════════════════════════

Tests:
  - Login: valid creds → token stored as 'cc_platform_token', redirect to /
  - Login: invalid creds → error shown, no redirect, no token stored
  - Login: if token present + /me returns 200 → redirect to / immediately
  - API client: base URL is NEXT_PUBLIC_PLATFORM_API_URL (never NEXT_PUBLIC_API_URL)
  - API client: token key is 'cc_platform_token'
  - API client: on 401 → clearPlatformToken() called + redirect to /login
  - Route guard: / without token → redirect to /login
  - Sidebar: super_admin sees all nav items (9 total)
  - Sidebar: admin — Settings absent, Announcements present
  - Sidebar: support — Financials, Automations, Audit Log absent
  - Sidebar: billing — Users, Support, Automations, Security, Audit Log, Settings absent
  - Sidebar: readonly — only Overview and Organisations present
  - Logout: token cleared, redirect to /login
  - Overview: stat cards render correctly, loading skeletons shown, error banner on fail
  - Plan chart uses display names Foundation/Creator/Studio/Enterprise (not DB codes)

git add . && git commit -m "feat(cc-web-phase0-part5): phase 0 frontend tests"
```

**Merge Phase 0 Frontend:**
```bash
git push origin cc/phase-0-frontend
# Open PR → merge to main
git checkout main && git pull
```

**Phase 0 smoke test:**
```bash
cd wayfield/command && npm run build  # zero TypeScript errors
# Open browser: http://localhost:3001/login
# □ Login with admin@wayfieldapp.com works
# □ Dark sidebar renders with correct nav items for super_admin
# □ Overview dashboard loads with real data
# □ Sign out clears token and redirects to /login
# □ Tenant token returns 403 on /api/platform/v1/overview
```

---

# PHASE 1
# Organisation Management, Feature Flags, Audit Log

---

## Phase 1 — API

```bash
cd wayfield/api
git checkout main && git pull
git checkout -b cc/phase-1-api
```

**Run in:** `cd wayfield/api && claude`

```
You are building the Wayfield Command Center Phase 1 API:
organisation management, feature flags, and audit log retrieval.

Read before writing:
@../docs/command_center/COMMAND_CENTER_SCHEMA.md
@WAYFIELD_PAYMENT_SYSTEM_IMPLEMENTATION_GUIDE.md (Tables 40–42)

NON-NEGOTIABLE:
  Route prefix: /api/platform/v1/
  Guard: auth:platform_admin + platform.auth
  Every mutation: PlatformAuditService::record() — no exceptions
  Tenant token → 403 on all routes

PLAN CODES: subscriptions table uses free/starter/pro/enterprise.
  Display names are UI-only (Foundation/Creator/Studio/Enterprise).

═══════════════════════════════════════════════════════════
TASK 1 — VERIFY OR CREATE: feature_flags TABLES
═══════════════════════════════════════════════════════════

Check both tables:
  php artisan tinker --execute="
    echo 'feature_flags: '.(Schema::hasTable('feature_flags')?'EXISTS':'MISSING').PHP_EOL;
    echo 'org_feature_flags: '.(Schema::hasTable('organization_feature_flags')?'EXISTS':'MISSING').PHP_EOL;"

If BOTH exist with adequate columns: skip.

If MISSING, create migration create_feature_flags_tables:

  Schema::create('feature_flags', function (Blueprint $table) {
    $table->id();
    $table->string('feature_key', 100)->unique();
    $table->text('description')->nullable();
    $table->boolean('default_enabled')->default(false);
    $table->json('plan_defaults')->nullable(); // {"free":false,"starter":true,"pro":true,"enterprise":true}
    $table->timestamps();
  });

  Schema::create('organization_feature_flags', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('organization_id');
    $table->foreign('organization_id')->references('id')->on('organizations')->onDelete('cascade');
    $table->string('feature_key', 100);
    $table->boolean('is_enabled');
    $table->string('source', 50)->default('manual_override');
    $table->unsignedBigInteger('set_by_admin_user_id')->nullable();
    $table->timestamps();
    $table->unique(['organization_id', 'feature_key']);
    $table->index('organization_id');
  });

  php artisan migrate

  Seed feature flag definitions (idempotent):
    $flags = [
      ['feature_key'=>'analytics',       'description'=>'Advanced analytics dashboard',
       'plan_defaults'=>'{"free":false,"starter":false,"pro":true,"enterprise":true}'],
      ['feature_key'=>'api_access',      'description'=>'API and webhook access',
       'plan_defaults'=>'{"free":false,"starter":false,"pro":true,"enterprise":true}'],
      ['feature_key'=>'leader_messaging','description'=>'Advanced leader messaging',
       'plan_defaults'=>'{"free":false,"starter":true,"pro":true,"enterprise":true}'],
      ['feature_key'=>'waitlists',       'description'=>'Session waitlists',
       'plan_defaults'=>'{"free":false,"starter":true,"pro":true,"enterprise":true}'],
      ['feature_key'=>'custom_branding', 'description'=>'Custom branding and domain',
       'plan_defaults'=>'{"free":false,"starter":false,"pro":true,"enterprise":true}'],
    ];
    foreach ($flags as $f) { DB::table('feature_flags')->insertOrIgnore($f + ['created_at'=>now(),'updated_at'=>now()]); }

git add . && git commit -m "feat(cc-phase1-task1): verify or create feature flags schema and seed"

═══════════════════════════════════════════════════════════
TASK 2 — ORGANISATION ROUTES
═══════════════════════════════════════════════════════════

Create app/Http/Controllers/Api/Platform/OrganizationController.php

Add routes to routes/platform.php (inside auth group):
  Route::get('/organizations', [OrganizationController::class, 'index']);
  Route::get('/organizations/{id}', [OrganizationController::class, 'show']);
  Route::patch('/organizations/{id}/status', [OrganizationController::class, 'updateStatus']);
  Route::post('/organizations/{id}/billing/plan', [OrganizationController::class, 'changePlan']);
  Route::get('/organizations/{id}/feature-flags', [OrganizationController::class, 'featureFlags']);
  Route::post('/organizations/{id}/feature-flags', [OrganizationController::class, 'setFeatureFlag']);

INDEX:
  Query params: search (name), plan (plan_code), status, page (25/page)
  Join subscriptions for plan_code.
  Response per org: { id, name, slug, status, plan_code, contact_email,
    workshop_count, participant_count, manager_count, created_at }
  plan_code: from subscriptions table, default 'free' if no subscription row

SHOW:
  Full detail: org fields + subscription + usage counts.
  usage: { workshop_count, workshop_limit, participant_count, participant_limit,
           manager_count, manager_limit }
  Limits by plan: free(2/75/3), starter(10/250/5), pro(null), enterprise(null)
  workshop_count: count of org's workshops (all statuses)
  participant_count: count of registrations for org's workshops (status='registered')
  manager_count: count of organization_users where org_id = this org

UPDATESTATUS:
  Request: { status: 'active'|'suspended'|'inactive', reason: string (required) }
  Validate status is valid enum value.
  Update organizations.status.
  PlatformAuditService::record(
    adminUser: $request->user(), action: 'organization.status_changed',
    entityType: 'organization', entityId: $org->id,
    oldValue: ['status'=>$old], newValue: ['status'=>$new],
    metadata: ['reason'=>$reason], organizationId: $org->id
  )

CHANGEPLAN:
  Request: { plan_code: 'free'|'starter'|'pro'|'enterprise', reason: string }
  Role check: only super_admin and billing. Others: 403.
    if (!in_array($request->user()->role, ['super_admin','billing'])): return 403
  Update subscriptions.plan_code (upsert — create row if no subscription exists).
  PlatformAuditService::record(action: 'organization.plan_changed',
    oldValue:['plan_code'=>$old], newValue:['plan_code'=>$new],
    metadata:['reason'=>$reason], organizationId:$org->id)

FEATUREFLAGS (GET):
  Returns all feature_flags joined with organization_feature_flags for this org.
  Response per flag: { feature_key, description, is_enabled, source }
  is_enabled: if org override exists → use that; else → plan default from plan_defaults JSON.

SETFEATUREFLAG (POST):
  Request: { feature_key: string, is_enabled: boolean }
  Role: only super_admin and admin. Others: 403.
  Upsert organization_feature_flags.
  PlatformAuditService::record(action: 'feature_flag_override',
    oldValue:['is_enabled'=>$old], newValue:['is_enabled'=>$new],
    metadata:['feature_key'=>$key], organizationId:$org->id)

git add . && git commit -m "feat(cc-phase1-task2): organisation management routes"

═══════════════════════════════════════════════════════════
TASK 3 — AUDIT LOG RETRIEVAL
═══════════════════════════════════════════════════════════

Add route: Route::get('/audit-logs', [AuditLogController::class, 'index']);
Create: app/Http/Controllers/Api/Platform/AuditLogController.php

INDEX:
  Query params: admin_user_id, organization_id, action (partial LIKE match),
    date_from, date_to, page (50/page)
  Join admin_users for admin name. Join organizations for org name.
  Order: created_at DESC.
  Response per entry: { id, action, entity_type, entity_id, admin_user_id,
    admin_name, organization_id, organization_name, old_value_json,
    new_value_json, metadata_json, created_at }

git add . && git commit -m "feat(cc-phase1-task3): audit log retrieval route"

═══════════════════════════════════════════════════════════
TASK 4 — TESTS: PHASE 1 API
═══════════════════════════════════════════════════════════

Create tests/Feature/Platform/OrganizationManagementTest.php:
  - GET /organizations → 200 + paginated list with correct shape
  - GET /organizations?search=xyz → filters by name
  - GET /organizations?plan=starter → filters by plan_code
  - GET /organizations/{id} → 200 + full detail with usage
  - GET /organizations/{id} not found → 404
  - PATCH /organizations/{id}/status → updates status + platform_audit_logs entry written
  - PATCH /organizations/{id}/status missing reason → 422
  - POST /organizations/{id}/billing/plan with super_admin → 200 + audit log
  - POST /organizations/{id}/billing/plan with admin role → 403
  - POST /organizations/{id}/billing/plan with support role → 403
  - POST /organizations/{id}/feature-flags with admin → 200 + audit log
  - POST /organizations/{id}/feature-flags with support → 403
  - GET /organizations/{id}/feature-flags → returns all flags with correct is_enabled
  - All routes: 403 with tenant sanctum token

Create tests/Feature/Platform/AuditLogTest.php:
  - GET /audit-logs → 200 + paginated from platform_audit_logs (NOT audit_logs)
  - GET /audit-logs?organization_id=1 → filters correctly
  - GET /audit-logs?action=plan_changed → partial match works
  - 403 with tenant token

./vendor/bin/pest tests/Feature/Platform/
All green before committing.

git add . && git commit -m "feat(cc-phase1-task4): phase 1 API tests"
```

**Merge Phase 1 API:**
```bash
git push origin cc/phase-1-api
# Open PR → merge to main
git checkout main && git pull
```

**Verify:**
```bash
TOKEN="your-platform-token"
# Org list
curl -s "http://localhost:8000/api/platform/v1/organizations" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Feature flags for org 1
curl -s "http://localhost:8000/api/platform/v1/organizations/1/feature-flags" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

---

## Phase 1 — Frontend

```bash
cd wayfield/command
git checkout main && git pull
git checkout -b cc/phase-1-frontend
```

**Run in:** `cd wayfield/command && claude`

```
You are building CC-Web Phase 1: organisation management screens.
Phase 0 is complete and merged. All shared components from Phase 0 are available.

Read before writing:
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md

PLAN NAMES: Always use display names in UI.
  free→Foundation, starter→Creator, pro→Studio, enterprise→Enterprise
  Plan badge colors: Foundation=gray, Creator=teal, Studio=orange, Enterprise=purple

═══════════════════════════════════════════════════════════
PART 1 — SHARED COMPONENTS
═══════════════════════════════════════════════════════════

Create the following before building any pages:

components/ui/PlanBadge.tsx
  Props: plan: 'free'|'starter'|'pro'|'enterprise'
  Renders display name with correct color badge.
  free→Foundation/gray, starter→Creator/teal, pro→Studio/orange, enterprise→Enterprise/purple
  Shape: font-mono text-xs font-medium rounded-full px-2 py-0.5 border

components/ui/StatusBadge.tsx
  Props: status: string
  active/complete → teal, suspended/restricted/deauthorized → red,
  pending/past_due → amber, inactive/canceled → gray, draft → blue
  Shape: same as PlanBadge

components/ui/UsageBar.tsx
  Props: value: number, limit: number|null
  < 80%: bg-teal-500, 80-99%: bg-amber-500, ≥100%: bg-red-500
  If limit null: show "Unlimited" text, bar at 30% teal
  Label: "{value} of {limit}" or "{value} (unlimited)"

components/ui/ConfirmModal.tsx
  Props: title, body, confirmLabel, onConfirm, onCancel, destructive?, requireTyping?
  If requireTyping: shows text input, confirm button disabled until typed value matches
  Cannot be dismissed by backdrop click.
  Destructive confirm button: bg-[#E94F37]

components/ui/Toast.tsx + useToast hook
  Fixed top-4 right-4 z-50. Slide in from right 200ms. Auto-dismiss 4s.
  success: bg-green-600, error: bg-red-600, info: bg-blue-600. All text-white.

components/ui/EmptyState.tsx
  Props: icon (lucide component), heading, subtitle, action?
  Centered, icon 32px gray-300, heading text-sm font-medium gray-500

components/ui/ErrorBanner.tsx
  Props: message, onRetry
  bg-red-50 border border-red-200 rounded-xl px-4 py-3
  AlertTriangle (red-500 16px) + message + Retry button min-h-[44px]

components/ui/Pagination.tsx
  "Showing X–Y of Z" (font-mono text-xs gray-500) + Previous/Next (min-h-[44px])

git add . && git commit -m "feat(cc-web-phase1-part1): shared UI components"

═══════════════════════════════════════════════════════════
PART 2 — ORGANISATIONS LIST
═══════════════════════════════════════════════════════════

File: app/(admin)/organizations/page.tsx
API: GET /api/platform/v1/organizations

FILTER BAR (flex gap-3 mb-6):
  Search input (w-72, Search icon prepend, debounce 300ms)
  Plan filter dropdown (Foundation/Creator/Studio/Enterprise checkboxes)
  Status filter (All | Active | Inactive | Suspended)
  All filters update URL search params and re-fetch.

TABLE (bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden):
  Columns: NAME | PLAN | STATUS | PARTICIPANTS | WORKSHOPS | MANAGERS | VIEW
  NAME: font-sans text-sm font-medium text-gray-900, link → /organizations/{id}
  PLAN: <PlanBadge plan={org.plan_code} />
  STATUS: <StatusBadge status={org.status} />
  PARTICIPANTS/WORKSHOPS/MANAGERS: font-mono text-sm text-gray-600
  VIEW: "View →" text-[#0FA3B1] font-medium text-sm min-h-[44px] flex items-center

PAGINATION: <Pagination /> below table.
LOADING: 8 skeleton rows animate-pulse bg-gray-100 h-12 rounded
EMPTY: <EmptyState icon={Building2} heading="No organisations found" subtitle="Try adjusting your filters." />
ERROR: <ErrorBanner message="Failed to load organisations." onRetry={refetch} />

git add . && git commit -m "feat(cc-web-phase1-part2): organisations list"

═══════════════════════════════════════════════════════════
PART 3 — ORGANISATION DETAIL WITH TABS
═══════════════════════════════════════════════════════════

Files: app/(admin)/organizations/[id]/page.tsx

Fetch: GET /api/platform/v1/organizations/{id}

PAGE HEADER:
  H1 org.name + <StatusBadge /> + <PlanBadge /> (ml-2 each)
  "← Organisations" link (text-sm text-gray-500 hover:text-gray-700 min-h-[44px])

TABS (border-b border-gray-200 mb-6, height 44px each):
  Overview | Billing | Feature Flags | Usage | Audit
  Active: border-b-2 border-[#0FA3B1] text-[#0FA3B1] font-medium
  Inactive: text-gray-500 hover:text-gray-700 border-b-2 border-transparent
  Tab via ?tab= URL param. Default: overview.
  Feature Flags: hidden for billing and support roles
  Audit: hidden for billing and readonly roles

OVERVIEW TAB:
  grid grid-cols-2 gap-6
  Left: org details card (slug, email, phone, created, updated) +
        subscription card (plan badge, status, period dates)
  Right: 3 stat mini-cards (Workshops, Participants, Managers)
  Stat mini-card: bg-white rounded-xl border p-4
    label: font-mono text-xs uppercase tracking-widest text-gray-400
    value: font-heading text-2xl font-bold gray-900
    subtitle: text-sm text-gray-500

BILLING TAB:
  ALWAYS show staleness notice at top:
    bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-2
    AlertTriangle amber-500 16px + "Billing data is mirrored from Stripe and may not
    reflect real-time changes until the Stripe webhook handler is configured."
  Current plan display + status.
  "Change Plan" button: only for can.manageBilling(adminUser.role) — super_admin + billing.
  If no invoices: placeholder "Invoice history not yet available — Stripe webhook required."

PLAN CHANGE MODAL (ConfirmModal, requireTyping=false but cannot dismiss via backdrop):
  Title "Change Plan — {org.name}"
  Radio buttons: Foundation / Creator / Studio / Enterprise (with PlanBadge on each)
  Reason textarea (required, minLength 10)
  Warning if downgrading: bg-amber-50 border-amber-200 rounded-lg px-4 py-3
  Confirm: POST /api/platform/v1/organizations/{id}/billing/plan
  Loading state on button. On success: close, refresh org, toast.
  On error: show error inside modal, do not close.

FEATURE FLAGS TAB (hidden for billing, support roles):
  Fetch: GET /api/platform/v1/organizations/{id}/feature-flags
  Table: FEATURE | DESCRIPTION | SOURCE | ENABLED | OVERRIDE
  SOURCE: "plan default" gray badge | "manual override" teal badge
  OVERRIDE toggle: only for super_admin and admin (can.manageFeatureFlags)
    On: bg-[#0FA3B1]. Off: bg-gray-200. Wrapper: min-h-[44px] flex items-center.
  On toggle: POST, optimistic UI, revert on error, toast on success.

USAGE TAB:
  3 <UsageBar /> rows: Workshops | Participants | Managers
  Label + bar + count/limit text.

AUDIT TAB (hidden for billing, readonly roles):
  Fetch: GET /api/platform/v1/audit-logs?organization_id={id}
  Note: "Platform admin actions only — not tenant audit events."
  Table: Date/Time | Admin | Action (teal badge) | Entity | Expand chevron
  Expandable row: old/new/metadata JSON in code blocks (font-mono text-xs bg-gray-50)

git add . && git commit -m "feat(cc-web-phase1-part3): organisation detail with tabs"

═══════════════════════════════════════════════════════════
PART 4 — TESTS: PHASE 1 FRONTEND
═══════════════════════════════════════════════════════════

  - Org list: search debounces, plan filter uses display names, loads correctly
  - Plan badge shows Foundation/Creator/Studio/Enterprise (never raw DB codes)
  - Feature Flags tab not rendered for billing and support roles
  - Audit tab not rendered for billing and readonly roles
  - Plan Change button absent for admin and support roles
  - Plan change modal cannot be dismissed by backdrop click
  - Feature flag toggle: optimistic update + rollback on API error
  - Usage bar: red at 100%+, amber at 80–99%, teal below 80%
  - Staleness notice always visible on billing tab regardless of role

git add . && git commit -m "feat(cc-web-phase1-part4): phase 1 frontend tests"
```

**Merge Phase 1 Frontend:**
```bash
git push origin cc/phase-1-frontend
# Open PR → merge to main
git checkout main && git pull
```

---

# PHASE 2
# Users, Financials, Payment Controls, Support

---

## Phase 2 — API

```bash
cd wayfield/api
git checkout main && git pull
git checkout -b cc/phase-2-api
```

**Run in:** `cd wayfield/api && claude`

```
You are building the Wayfield Command Center Phase 2 API:
users, financials (Stripe mirror), payment flag controls, take rates,
Stripe Connect oversight, and the support external link screen.

Read before writing:
@../docs/command_center/COMMAND_CENTER_SCHEMA.md
@../docs/command_center/CC_PAYMENTS_AND_GAP_ANALYSIS.md
@WAYFIELD_PAYMENT_SYSTEM_IMPLEMENTATION_GUIDE.md

NON-NEGOTIABLE:
  Route prefix: /api/platform/v1/
  Guard: auth:platform_admin + platform.auth
  PlatformAuditService::record() on every mutation
  Tenant token → 403 on all routes

PLAN CODE NOTE:
  platform_take_rates.plan_code ENUM: foundation/creator/studio/custom
  subscriptions.plan_code ENUM: free/starter/pro/enterprise
  These are DIFFERENT enums in DIFFERENT tables. Do not conflate them.

═══════════════════════════════════════════════════════════
TASK 1 — VERIFY OR CREATE: login_events TABLE
═══════════════════════════════════════════════════════════

Check: php artisan tinker --execute="echo Schema::hasTable('login_events') ? 'EXISTS' : 'MISSING';"

If EXISTS with user_id, ip_address, outcome, created_at: skip.

If MISSING:
  Schema::create('login_events', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('user_id');
    $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
    $table->string('ip_address', 45)->nullable();
    $table->text('user_agent')->nullable();
    $table->enum('outcome', ['success','failed','blocked'])->default('success');
    $table->dateTime('created_at');
    $table->index(['user_id', 'created_at']);
  });
  php artisan migrate

git add . && git commit -m "feat(cc-phase2-task1): verify or create login_events table"

═══════════════════════════════════════════════════════════
TASK 2 — VERIFY OR CREATE: STRIPE MIRROR TABLES
═══════════════════════════════════════════════════════════

Check all four:
  php artisan tinker --execute="
    foreach(['stripe_customers','stripe_subscriptions','stripe_invoices','stripe_events'] as \$t)
      echo \$t.': '.(Schema::hasTable(\$t)?'EXISTS':'MISSING').PHP_EOL;"

Create any that are MISSING. For tables that exist, skip their Schema::create block.

  Schema::create('stripe_customers', function (Blueprint $table) {
    $table->id(); $table->unsignedBigInteger('organization_id')->unique();
    $table->foreign('organization_id')->references('id')->on('organizations')->onDelete('cascade');
    $table->string('stripe_customer_id', 100)->unique(); $table->timestamps();
  });

  Schema::create('stripe_subscriptions', function (Blueprint $table) {
    $table->id(); $table->unsignedBigInteger('organization_id');
    $table->foreign('organization_id')->references('id')->on('organizations')->onDelete('cascade');
    $table->string('stripe_subscription_id', 100)->unique()->nullable();
    $table->string('plan_code', 50)->default('free');
    $table->enum('status',['active','trialing','past_due','canceled','incomplete','unpaid'])->default('active');
    $table->dateTime('current_period_start')->nullable(); $table->dateTime('current_period_end')->nullable();
    $table->dateTime('trial_ends_at')->nullable(); $table->timestamps();
    $table->index('organization_id'); $table->index('status'); $table->index('plan_code');
  });

  Schema::create('stripe_invoices', function (Blueprint $table) {
    $table->id(); $table->unsignedBigInteger('organization_id');
    $table->foreign('organization_id')->references('id')->on('organizations')->onDelete('cascade');
    $table->string('stripe_invoice_id', 100)->unique();
    $table->unsignedInteger('amount_due')->default(0);
    $table->unsignedInteger('amount_paid')->default(0);
    $table->char('currency', 3)->default('usd');
    $table->enum('status',['draft','open','paid','uncollectible','void'])->default('open');
    $table->string('invoice_pdf_url', 1000)->nullable();
    $table->dateTime('invoice_date'); $table->timestamps();
    $table->index(['organization_id','status']);
  });

  Schema::create('stripe_events', function (Blueprint $table) {
    $table->id(); $table->string('stripe_event_id', 100)->unique();
    $table->string('event_type', 100); $table->json('payload_json');
    $table->dateTime('processed_at')->nullable(); $table->dateTime('created_at');
    $table->index('event_type');
  });

  php artisan migrate

git add . && git commit -m "feat(cc-phase2-task2): verify or create stripe mirror tables"

═══════════════════════════════════════════════════════════
TASK 3 — VERIFY OR CREATE: payment_feature_flags TABLE
═══════════════════════════════════════════════════════════

Check: php artisan tinker --execute="echo Schema::hasTable('payment_feature_flags') ? 'EXISTS' : 'MISSING';"

If EXISTS: skip.

If MISSING:
  Schema::create('payment_feature_flags', function (Blueprint $table) {
    $table->id();
    $table->enum('scope', ['platform','organization'])->default('platform');
    $table->unsignedBigInteger('organization_id')->nullable();
    $table->foreign('organization_id')->references('id')->on('organizations')->onDelete('cascade');
    $table->string('flag_key', 100);
    $table->boolean('is_enabled')->default(false);
    $table->dateTime('enabled_at')->nullable();
    $table->text('notes')->nullable();
    $table->timestamps();
    $table->unique(['scope','organization_id','flag_key']);
    $table->index(['scope','flag_key','is_enabled']);
  });
  php artisan migrate

  Seed platform payments_enabled flag (global kill switch, starts FALSE):
  DB::table('payment_feature_flags')->insertOrIgnore([
    'scope' => 'platform', 'organization_id' => null,
    'flag_key' => 'payments_enabled', 'is_enabled' => false,
    'created_at' => now(), 'updated_at' => now()
  ]);

git add . && git commit -m "feat(cc-phase2-task3): verify or create payment_feature_flags table"

═══════════════════════════════════════════════════════════
TASK 4 — VERIFY OR CREATE: platform_take_rates TABLE
═══════════════════════════════════════════════════════════

Check: php artisan tinker --execute="echo Schema::hasTable('platform_take_rates') ? 'EXISTS' : 'MISSING';"

If EXISTS: skip.

If MISSING:
  Schema::create('platform_take_rates', function (Blueprint $table) {
    $table->id();
    $table->enum('plan_code', ['foundation','creator','studio','custom'])->unique();
    $table->decimal('take_rate_pct', 5, 4);
    $table->boolean('is_active')->default(true);
    $table->text('notes')->nullable();
    $table->timestamps();
    $table->unique('plan_code'); $table->index('is_active');
  });
  php artisan migrate

  Seed take rates:
  $rates = [
    ['plan_code'=>'foundation','take_rate_pct'=>0.0650],
    ['plan_code'=>'creator',   'take_rate_pct'=>0.0400],
    ['plan_code'=>'studio',    'take_rate_pct'=>0.0200],
    ['plan_code'=>'custom',    'take_rate_pct'=>0.0200],
  ];
  foreach ($rates as $r) {
    DB::table('platform_take_rates')->insertOrIgnore($r + ['is_active'=>true,'created_at'=>now(),'updated_at'=>now()]);
  }

git add . && git commit -m "feat(cc-phase2-task4): verify or create platform_take_rates with seed"

═══════════════════════════════════════════════════════════
TASK 5 — USER MANAGEMENT ROUTES
═══════════════════════════════════════════════════════════

Create: app/Http/Controllers/Api/Platform/UserController.php

Add to routes/platform.php:
  Route::get('/users', [UserController::class, 'index']);
  Route::get('/users/{id}', [UserController::class, 'show']);

INDEX:
  Query params: search (name or email), page (25/page)
  Response per user: { id, first_name, last_name, email, is_active,
    email_verified_at, last_login_at, created_at, organization_count }
  organization_count: count of organization_users rows for this user

SHOW:
  Response: all user fields +
    organizations: [{ id, name, role, joined_at }] (join org_users + organizations)
    login_history: last 10 from login_events DESC, or [] if table empty

No mutation routes. Platform admins read tenant users — they do not modify directly.

git add . && git commit -m "feat(cc-phase2-task5): user management routes"

═══════════════════════════════════════════════════════════
TASK 6 — FINANCIALS ROUTES
═══════════════════════════════════════════════════════════

Create: app/Http/Controllers/Api/Platform/FinancialsController.php

Add to routes/platform.php:
  Route::get('/financials/overview', [FinancialsController::class, 'overview']);
  Route::get('/financials/invoices', [FinancialsController::class, 'invoices']);

OVERVIEW:
  Plan monthly prices in cents (for MRR calc): free=0, starter=4900, pro=14900, enterprise=0
  MRR = sum of plan prices for active stripe_subscriptions (null if table empty)
  stripe_webhook_connected = stripe_events has any row with processed_at NOT NULL
  Response: { mrr_cents, arr_cents, subscriptions: { active, trialing, past_due,
    canceled, by_plan: {free,starter,pro,enterprise} }, stripe_webhook_connected }

INVOICES:
  Query params: status (paid|open|uncollectible|void|draft), page (25/page)
  Join organizations for org name. Order: invoice_date DESC.

git add . && git commit -m "feat(cc-phase2-task6): financials overview and invoices routes"

═══════════════════════════════════════════════════════════
TASK 7 — PAYMENT CONTROL ROUTES
═══════════════════════════════════════════════════════════

Create: app/Http/Controllers/Api/Platform/PaymentControlController.php

Add to routes/platform.php:
  Route::get('/payments/status', [PaymentControlController::class, 'status']);
  Route::post('/payments/enable', [PaymentControlController::class, 'enablePlatform']);
  Route::post('/payments/disable', [PaymentControlController::class, 'disablePlatform']);
  Route::get('/organizations/{id}/payments', [PaymentControlController::class, 'orgStatus']);
  Route::post('/organizations/{id}/payments/enable', [PaymentControlController::class, 'enableOrg']);
  Route::post('/organizations/{id}/payments/disable', [PaymentControlController::class, 'disableOrg']);
  Route::get('/payments/take-rates', [PaymentControlController::class, 'takeRates']);
  Route::patch('/payments/take-rates/{plan_code}', [PaymentControlController::class, 'updateTakeRate']);
  Route::get('/payments/connect-accounts', [PaymentControlController::class, 'connectAccounts']);
  Route::get('/payments/connect-accounts/{organization_id}', [PaymentControlController::class, 'connectAccountDetail']);

PAYMENT STATUS ROLE CHECK (for enable/disable platform and take-rate update):
  enablePlatform/disablePlatform: in_array($admin->role, ['super_admin','billing']) or 403
  updateTakeRate: $admin->role === 'super_admin' or 403 (NOT billing)
  enableOrg/disableOrg: in_array($admin->role, ['super_admin','billing']) or 403

STATUS endpoint:
  platform_payments_enabled: from payment_feature_flags where scope='platform' AND flag_key='payments_enabled'
  orgs_payment_enabled_count: count of org-scope org_payments_enabled flags where is_enabled=true
  orgs_stripe_connected_count: count of stripe_connect_accounts rows
  orgs_stripe_charges_enabled_count: count where charges_enabled=true
  warning: if platform enabled AND any orgs have no stripe connection:
    "X organisations are payment-enabled but have not completed Stripe Connect."

ENABLE/DISABLE PLATFORM:
  Update payment_feature_flags: scope=platform, flag_key=payments_enabled, is_enabled=true/false
  PlatformAuditService::record(action: 'platform_payments.enabled'/'platform_payments.disabled')

ORG STATUS endpoint:
  Returns org-specific payment_feature_flags + stripe_connect_accounts row (if exists)
  effective_payments_active: platform_enabled AND org_enabled AND charges_enabled

ENABLE/DISABLE ORG:
  Upsert payment_feature_flags: scope=organization, organization_id={id},
    flag_key=org_payments_enabled, is_enabled=true/false
  PlatformAuditService::record(action: 'org_payments.enabled'/'org_payments.disabled',
    entityType:'organization', entityId:$id, organizationId:$id)

TAKE RATES:
  GET: return all platform_take_rates ordered by plan_code
    Each row adds: fee_on_100 (floor(100 * take_rate_pct * 100) / 100 formatted as string)
  PATCH: validate take_rate_pct between 0.0000 and 0.2000 (422 if outside)
    Update row, PlatformAuditService::record(action:'take_rate.updated',
      oldValue:['take_rate_pct'=>$old], newValue:['take_rate_pct'=>$new])

CONNECT ACCOUNTS:
  GET list: paginated 25/page, filter by onboarding_status and charges_enabled
    Join organizations for name. has_pending_requirements: requirements_json not null/empty
  GET detail: full row including capabilities_json and requirements_json

git add . && git commit -m "feat(cc-phase2-task7): payment control routes"

═══════════════════════════════════════════════════════════
TASK 8 — TESTS: PHASE 2 API
═══════════════════════════════════════════════════════════

Create tests/Feature/Platform/UserManagementTest.php:
  - GET /users → 200 + paginated
  - GET /users?search=john → filters
  - GET /users/{id} → 200 + org memberships + login_history (empty array if no events)
  - GET /users/{id} not found → 404
  - All routes: 403 with tenant token

Create tests/Feature/Platform/FinancialsTest.php:
  - GET /financials/overview → 200 with correct shape
  - mrr_cents is null when stripe_subscriptions is empty
  - stripe_webhook_connected is false when no processed stripe_events
  - GET /financials/invoices → 200 + paginated
  - All routes: 403 with tenant token

Create tests/Feature/Platform/PaymentControlTest.php:
  - GET /payments/status → 200 with platform_payments_enabled bool
  - POST /payments/enable with super_admin → updates flag + writes audit log
  - POST /payments/disable with billing role → updates flag + writes audit log
  - POST /payments/enable with admin role → 403
  - POST /payments/enable with support role → 403
  - GET /organizations/{id}/payments → 200 with correct shape
  - POST /organizations/{id}/payments/enable → upserts flag + audit log
  - GET /payments/take-rates → 200 with 4 rows (foundation/creator/studio/custom)
  - PATCH /payments/take-rates/creator with super_admin → updates + audit log
  - PATCH /payments/take-rates/creator with billing role → 403
  - PATCH /payments/take-rates/creator with value 0.2500 → 422 (exceeds 20% max)
  - GET /payments/connect-accounts → 200 + paginated
  - All routes: 403 with tenant token

./vendor/bin/pest tests/Feature/Platform/
All green before committing.

git add . && git commit -m "feat(cc-phase2-task8): phase 2 API tests"
```

**Merge Phase 2 API:**
```bash
git push origin cc/phase-2-api
# Open PR → merge to main
git checkout main && git pull
```

---

## Phase 2 — Frontend

```bash
cd wayfield/command
git checkout main && git pull
git checkout -b cc/phase-2-frontend
```

**Run in:** `cd wayfield/command && claude`

```
You are building CC-Web Phase 2: Users, Financials (with Payment Controls), and Support.

Read before writing:
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md
@../docs/command_center/CC_PAYMENTS_AND_GAP_ANALYSIS.md

PLAN NAMES: Always Foundation/Creator/Studio/Enterprise in UI.
PAYMENT CONTROLS: Platform toggle requires type-to-confirm ("DISABLE").
  Per-org toggle does not require type-to-confirm.
  Take rate edits: super_admin only.

═══════════════════════════════════════════════════════════
PART 1 — USERS LIST AND SLIDE-OVER
═══════════════════════════════════════════════════════════

File: app/(admin)/users/page.tsx
Role guard: if (!can.viewUsers(adminUser.role)) redirect('/')
API: GET /api/platform/v1/users

Search input (debounce 300ms) + Table.
Columns: NAME | EMAIL | ORGS | LAST LOGIN | VERIFIED | VIEW
Verified: CheckCircle (teal, aria-label="Verified") or XCircle (gray-300, aria-label="Not verified")
  Never color alone — always include aria-label (Apple HIG accessibility).
VIEW: opens UserSlideOver. Does NOT navigate away from page.

USER SLIDE-OVER (components/UserSlideOver.tsx):
  480px from right. Backdrop rgba(0,0,0,0.4). Clicking backdrop closes.
  Close button X top-right, min-h-[44px] min-w-[44px].
  Fetch GET /api/platform/v1/users/{id} on open.

  Header: full name (Sora 20px) + email (gray-500) + verified badge + "Joined {date}"
  Section 1 — Organisations:
    Each row: org name (link → /organizations/{id}) + role badge
    role badge colors: owner=coral, admin=blue, leader=teal, participant=gray, staff=purple
    Empty: "No organisation memberships." gray-400

  Section 2 — Login History:
    Last 10 entries (font-mono text-xs):
      Date/time (gray-500) | outcome badge
      outcome: success=teal, failed=amber, blocked=red
      Include aria-labels on outcome badges.
    Empty: "No login history." gray-400

  Read only. No edit or delete controls.
  Loading: skeleton lines within slide-over while fetching.

git add . && git commit -m "feat(cc-web-phase2-part1): users list and slide-over"

═══════════════════════════════════════════════════════════
PART 2 — FINANCIALS: OVERVIEW AND INVOICES TABS
═══════════════════════════════════════════════════════════

File: app/(admin)/financials/page.tsx
Role guard: if (!can.viewFinancials(adminUser.role)) redirect('/')

TABS: Overview | Invoices | Payment Controls | Take Rates | Stripe Connect
Tab via ?tab= URL param. Default: overview.

STALENESS NOTICE — always visible on Overview and Invoices tabs:
  bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6
  AlertTriangle amber-500 20px + text block:
    Primary: "Billing data may not be current." (font-medium amber-800)
    Secondary: "Data is mirrored from Stripe and may not reflect real-time
    changes until the Stripe webhook handler is configured."

  If stripe_webhook_connected = false: add bold note in amber-700:
    "⚠ Stripe webhook is not connected. Billing data is not being updated automatically."

OVERVIEW TAB:
  ROW 1 — 4 stat cards: MRR | ARR | Active Subscriptions | Trialing
  ROW 2 — 2 panels:
    Left: recharts BarChart by plan (display names on X axis)
      Foundation=gray, Creator=teal, Studio=orange, Enterprise=purple
    Right: subscription status breakdown (active/trialing/past_due/canceled)
      Each status: label + count + percentage of total

INVOICES TAB:
  Status filter tabs: All | Paid | Unpaid | Overdue
  Table: Organisation (link) | Date | Amount | Status | PDF Download

git add . && git commit -m "feat(cc-web-phase2-part2): financials overview and invoices tabs"

═══════════════════════════════════════════════════════════
PART 3 — PAYMENT CONTROLS TAB
═══════════════════════════════════════════════════════════

Tab: Payment Controls (?tab=payment-controls) in /financials

PLATFORM PAYMENT SWITCH CARD (prominent, top of tab):
  bg-white rounded-2xl p-8 shadow-md
  Border: border-2 border-teal-400 when ON, border-2 border-amber-400 when OFF

  Left column:
    Status label (font-mono text-xs uppercase tracking-widest):
      ON: "GLOBAL PAYMENTS — ACTIVE" text-teal-600
      OFF: "GLOBAL PAYMENTS — DISABLED" text-amber-600
    Large status badge (not a toggle switch — use a badge)
    Subtitle: "Controls payment surfaces across all {orgs_payment_enabled_count} organisations"

  Right column (super_admin and billing only — can.managePayments):
    When OFF: "Enable Platform Payments" button
      bg-[#0FA3B1] text-white px-6 min-h-[44px] rounded-lg
    When ON: "Disable Platform Payments" button
      bg-[#E94F37] text-white px-6 min-h-[44px] rounded-lg

ENABLE MODAL (ConfirmModal):
  Title "Enable Platform Payments"
  Body: "This will make payment surfaces visible to all organisations
         that are individually enabled ({count} orgs ready)."
  Confirm: "Enable Payments" (teal)
  Cannot dismiss via backdrop.

DISABLE MODAL (ConfirmModal with requireTyping):
  Title "⚠ Disable Platform Payments"
  Body in amber callout box:
    "This is a platform-wide action. ALL payment surfaces across ALL
     organisations will be hidden immediately. This affects
     {orgs_payment_enabled_count} organisations currently accepting payments."
  requireTyping: user must type "DISABLE" exactly before confirm button activates.
  Confirm button text: "Disable All Payments" (Coral Red bg-[#E94F37])
  Confirm button disabled until typed value === "DISABLE".

WARNING BANNER (below switch, if conditions met):
  Any orgs with is_enabled=true but no Stripe Connect or charges_enabled=false:
    bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-4
    "{orgs_stripe_connected_count - orgs_stripe_charges_enabled_count} organisations are
     payment-enabled but Stripe Connect is incomplete — they cannot process payments."

STATS ROW (grid grid-cols-3 gap-4 mt-6):
  "ORGS WITH PAYMENTS ON" | "STRIPE CONNECTED" | "CHARGES ENABLED"
  Each: bg-gray-50 rounded-xl border border-gray-200 p-4
  Value: font-heading text-2xl font-bold gray-900
  Label: font-mono text-xs uppercase tracking-widest gray-400

git add . && git commit -m "feat(cc-web-phase2-part3): payment controls tab with platform toggle"

═══════════════════════════════════════════════════════════
PART 4 — TAKE RATES TAB
═══════════════════════════════════════════════════════════

Tab: Take Rates (?tab=take-rates) in /financials

INFO NOTICE (always visible):
  bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6 text-sm text-blue-700
  "Take rates are Wayfield's transaction fee on each participant payment.
   Deducted via Stripe Connect before funds transfer to organisers.
   Changes take effect on new transactions immediately."

TABLE (4 rows: foundation/creator/studio/custom):
  Columns: PLAN CODE (font-mono) | DISPLAY NAME (PlanBadge) | TAKE RATE | FEE ON $100 | NOTES | EDIT

  PLAN CODE: foundation/creator/studio/custom in font-mono text-sm gray-900
  DISPLAY NAME: use badge — foundation=Foundation/gray, creator=Creator/teal,
    studio=Studio/orange, custom=Enterprise/purple
  TAKE RATE: "{X.XX}%" font-mono text-sm font-medium gray-900
  FEE ON $100: "${X.XX}" font-mono text-sm gray-600
  NOTES: text-sm gray-400 (truncated 60 chars)
  EDIT button: visible for can.manageTakeRates(adminUser.role) ONLY (super_admin)
    Others: no button rendered (not disabled — absent).

EDIT MODAL (super_admin only):
  Title "Edit Take Rate — {display name}"
  Current rate displayed as reference (read only, gray text)
  New rate input: type="number" step="0.01" min="0" max="20"
    Append "%" label. Validate 0–20 range.
    Update live: "Fee on $100: ${calculated}" below input.
  Notes textarea (optional)
  Warning callout:
    "This change affects all future transactions for {display name}
     organisations. Past payments are unaffected."
  Confirm "Update Take Rate" (teal, min-h-[44px])
  On success: close, refresh table, toast.

git add . && git commit -m "feat(cc-web-phase2-part4): take rates tab"

═══════════════════════════════════════════════════════════
PART 5 — STRIPE CONNECT TAB
═══════════════════════════════════════════════════════════

Tab: Stripe Connect (?tab=stripe-connect) in /financials

SUMMARY CARDS (grid-cols-4 gap-4 mb-6):
  Complete (count): teal | Pending: amber | Restricted: orange | Deauthorized: red

FILTER BAR: status filter + charges_enabled filter (All/Yes/No)

TABLE:
  Org (link → /organizations/{id}?tab=payments) | Status | Charges | Payouts | Submitted | Last Webhook | View

  Status badge: complete=teal, pending=amber, initiated=blue, restricted=orange, deauthorized=red
  Charges/Payouts/Submitted: CheckCircle (teal, aria-label="Yes") or XCircle (gray-300, aria-label="No")
  Last Webhook: font-mono text-xs gray-400 relative timestamp or "Never"
  View: "→" min-h-[44px]

Read only — no mutations from this view.
Note at bottom: "Stripe Connect accounts are managed in the Stripe Dashboard."

git add . && git commit -m "feat(cc-web-phase2-part5): Stripe Connect oversight tab"

═══════════════════════════════════════════════════════════
PART 6 — PAYMENTS TAB IN ORGANISATION DETAIL
═══════════════════════════════════════════════════════════

Add "Payments" as a new tab in app/(admin)/organizations/[id]/page.tsx.
Position: after Usage, before Audit.
Visible to all roles. Mutations only for can.managePayments.

Tab content: fetch GET /api/platform/v1/organizations/{id}/payments

EFFECTIVE STATUS BANNER (always first):
  All conditions met → green: "Payments are ACTIVE for this organisation"
  Platform OFF → amber: "Platform payments are globally disabled."
  Org disabled → gray: "Payments are disabled for this organisation."
  Stripe not complete → red: "Stripe Connect incomplete — cannot process payments."

ORG PAYMENT TOGGLE CARD:
  org_payments_enabled badge (ACTIVE=teal / DISABLED=gray)
  Enable/Disable button (can.managePayments only). No type-to-confirm needed.
  On toggle: POST .../payments/enable or .../payments/disable, refresh, toast.

STRIPE CONNECT STATUS CARD:
  onboarding_status badge | charges_enabled | payouts_enabled | details_submitted (all with icons+aria)
  Last webhook received: relative or "Never"
  Stripe Account ID: font-mono text-xs gray-400 for reference
  If pending requirements_json: amber list of requirement strings
  Note + "Open Stripe Dashboard →" external link if stripe_account_id exists

ADDITIONAL FLAGS CARD:
  deposits_enabled toggle row + waitlist_payments toggle row
  Can.managePayments only for mutations.

git add . && git commit -m "feat(cc-web-phase2-part6): payments tab in organisation detail"

═══════════════════════════════════════════════════════════
PART 7 — SUPPORT PAGE
═══════════════════════════════════════════════════════════

File: app/(admin)/support/page.tsx
Role guard: if (!can.viewSupport(adminUser.role)) redirect('/')

Centered card (max-w-lg mx-auto mt-16):
  bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center

  MessageCircle icon (48px text-[#0FA3B1] mx-auto mb-4)
  H1 "Support" (Sora 22px font-semibold gray-900 mb-2)
  "Support tickets are managed in an external helpdesk. An integrated
   ticket system is planned for CC Phase 4." (Plus Jakarta Sans 14px gray-500 mb-6)

  "Open Support Dashboard" button:
    bg-[#0FA3B1] text-white px-8 min-h-[52px] rounded-xl text-sm font-medium w-full
    ExternalLink icon 16px at right
    Opens NEXT_PUBLIC_SUPPORT_TOOL_URL in new tab
    If env var not set: button disabled with tooltip "Configure NEXT_PUBLIC_SUPPORT_TOOL_URL"

  Note: font-mono text-xs text-gray-400 mt-4
    "NEXT_PUBLIC_SUPPORT_TOOL_URL — configure in .env"

git add . && git commit -m "feat(cc-web-phase2-part7): support page external link"

═══════════════════════════════════════════════════════════
PART 8 — TESTS: PHASE 2 FRONTEND
═══════════════════════════════════════════════════════════

  - /users redirects billing and readonly to /
  - User slide-over opens without navigating away
  - Slide-over closes on backdrop click
  - Verified column: both CheckCircle and XCircle have aria-labels
  - /financials redirects admin, support, readonly to /
  - Staleness notice always visible on overview and invoices tabs
  - Stripe_webhook_connected=false shows additional bold warning
  - Platform payment DISABLE modal: confirm button disabled until "DISABLE" typed
  - Platform payment DISABLE modal: button activates only on exact match "DISABLE"
  - Platform payment ENABLE modal: no type-to-confirm needed
  - Take rate EDIT button absent for billing role (not disabled — absent)
  - Take rate: fee-on-$100 updates live as user types new rate
  - Support page: button disabled when NEXT_PUBLIC_SUPPORT_TOOL_URL not set
  - Org detail Payments tab visible for all roles, mutations blocked for non-billing/admin

git add . && git commit -m "feat(cc-web-phase2-part8): phase 2 frontend tests"
```

**Merge Phase 2 Frontend:**
```bash
git push origin cc/phase-2-frontend
# Open PR → merge to main
git checkout main && git pull
```

---

# PHASE 3
# Automations, Security, Audit Log, Announcements, Settings

---

## Phase 3 — API

```bash
cd wayfield/api
git checkout main && git pull
git checkout -b cc/phase-3-api
```

**Run in:** `cd wayfield/api && claude`

```
You are building the Wayfield Command Center Phase 3 API:
automations, security events, platform config, admin user management,
system announcements, and the public tenant announcements endpoint.

Read before writing:
@../docs/command_center/COMMAND_CENTER_SCHEMA.md

NON-NEGOTIABLE:
  Route prefix: /api/platform/v1/
  Guard: auth:platform_admin + platform.auth
  PlatformAuditService::record() on every mutation
  Tenant token → 403 on all platform routes

═══════════════════════════════════════════════════════════
TASK 1 — VERIFY OR CREATE: OPERATIONS TABLES
═══════════════════════════════════════════════════════════

Check each:
  php artisan tinker --execute="
    foreach(['automation_rules','automation_runs','security_events',
             'platform_config'] as \$t)
      echo \$t.': '.(Schema::hasTable(\$t)?'EXISTS':'MISSING').PHP_EOL;"

Create any that are MISSING:

  automation_rules:
    id, organization_id FK, name VARCHAR(255), trigger_type VARCHAR(100),
    trigger_conditions_json JSON null, action_type VARCHAR(100),
    action_config_json JSON null, is_active BOOLEAN DEFAULT true,
    last_run_at DATETIME null, timestamps.
    INDEX organization_id, INDEX is_active.

  automation_runs:
    id, automation_rule_id FK CASCADE, triggered_at DATETIME,
    completed_at DATETIME null, outcome ENUM(success,failed,skipped),
    error_message TEXT null, created_at DATETIME.
    INDEX automation_rule_id.

  security_events:
    id, organization_id BIGINT UNSIGNED null, user_id BIGINT UNSIGNED null,
    event_type VARCHAR(100), severity ENUM(low,medium,high,critical),
    description TEXT null, metadata_json JSON null, created_at DATETIME.
    INDEX (severity, created_at), INDEX organization_id.

  platform_config:
    id, config_key VARCHAR(100) UNIQUE, config_value TEXT null,
    description TEXT null, updated_by_admin_user_id BIGINT UNSIGNED null,
    updated_at DATETIME.
    (No created_at — this is a key-value store, not a log)

  Seed platform_config defaults:
    config_key='support_tool_url', description='External support tool URL'
    config_key='maintenance_mode', description='Platform maintenance mode (true/false)'
    config_key='platform_name', description='Platform display name'
    config_key='max_free_workshops', description='Max active workshops on Foundation plan', config_value='2'
    config_key='max_free_participants', description='Max participants on Foundation plan', config_value='75'
    (Use insertOrIgnore for all)

  php artisan migrate

git add . && git commit -m "feat(cc-phase3-task1): verify or create operations tables"

═══════════════════════════════════════════════════════════
TASK 2 — AUTOMATION CRUD ROUTES
═══════════════════════════════════════════════════════════

Create: app/Http/Controllers/Api/Platform/AutomationController.php

Add to routes/platform.php:
  Route::get('/automations', [AutomationController::class, 'index']);
  Route::get('/automations/{id}', [AutomationController::class, 'show']);
  Route::post('/automations', [AutomationController::class, 'store']);
  Route::patch('/automations/{id}', [AutomationController::class, 'update']);
  Route::delete('/automations/{id}', [AutomationController::class, 'destroy']);

Role check on store/update/destroy:
  in_array($request->user()->role, ['super_admin','admin']) or return 403

INDEX: filter organization_id, trigger_type, is_active, page 25/page.
  Join organizations for org name. Response: id, org_id, org_name, name,
  trigger_type, action_type, is_active, last_run_at, created_at.

STORE/UPDATE: validate { organization_id, name, trigger_type, action_type,
  is_active?, trigger_conditions_json? (must be valid JSON string),
  action_config_json? (must be valid JSON string) }
  Audit all changes.

DESTROY: PlatformAuditService::record(action:'automation_rule.deleted'), then delete.

No "execute" endpoint. The automation execution engine is not built.

git add . && git commit -m "feat(cc-phase3-task2): automation CRUD routes"

═══════════════════════════════════════════════════════════
TASK 3 — SECURITY EVENTS ROUTE
═══════════════════════════════════════════════════════════

Add: Route::get('/security/events', [SecurityController::class, 'index']);
Create: app/Http/Controllers/Api/Platform/SecurityController.php

INDEX: filter severity (multi-value: ?severity[]=high&severity[]=critical),
  event_type, organization_id, date_from, date_to, page 50/page.
  Join organizations for org name. Join users for user email.
  Response per event: { id, event_type, severity, description, organization_id,
    organization_name, user_id, user_email, metadata_json, created_at }
  Read only. No mutations.

git add . && git commit -m "feat(cc-phase3-task3): security events route"

═══════════════════════════════════════════════════════════
TASK 4 — PLATFORM CONFIG ROUTES
═══════════════════════════════════════════════════════════

Add:
  Route::get('/config', [PlatformConfigController::class, 'index']);
  Route::put('/config/{key}', [PlatformConfigController::class, 'update']);

Create: app/Http/Controllers/Api/Platform/PlatformConfigController.php

INDEX: return all rows ordered by config_key.
  Response: [{ config_key, config_value, description, updated_at }]

UPDATE: super_admin ONLY. Others: 403.
  Validate: { value: nullable string }
  Update config_value, updated_by_admin_user_id, updated_at.
  PlatformAuditService::record(action:'platform_config.updated',
    oldValue:['value'=>$old], newValue:['value'=>$new],
    metadata:['config_key'=>$key])

git add . && git commit -m "feat(cc-phase3-task4): platform config routes"

═══════════════════════════════════════════════════════════
TASK 5 — ADMIN USER MANAGEMENT ROUTES
═══════════════════════════════════════════════════════════

Create: app/Http/Controllers/Api/Platform/AdminUserController.php

Add to routes/platform.php:
  Route::get('/admins', [AdminUserController::class, 'index']);
  Route::post('/admins', [AdminUserController::class, 'store']);
  Route::patch('/admins/{id}/role', [AdminUserController::class, 'updateRole']);
  Route::patch('/admins/{id}/status', [AdminUserController::class, 'updateStatus']);

ALL ROUTES: $request->user()->role === 'super_admin' or return 403.

LAST-SUPER-ADMIN GUARD helper:
  private function lastSuperAdmin(int $excludeId): bool {
    return AdminUser::where('role','super_admin')->where('is_active',true)
                    ->where('id','!=',$excludeId)->doesntExist();
  }

INDEX: all admin_users order by role then created_at.
  Response: { id, first_name, last_name, email, role, is_active, last_login_at, created_at }

STORE: validate { first_name, last_name, email (unique in admin_users),
  password (min 12), password_confirmation, role (must NOT be 'super_admin') }
  super_admin role cannot be created via store — only granted via updateRole.
  Hash password. Set is_active=true. Audit: action='admin_user.created'.

UPDATEROLE: validate { role: one of AdminUser::ROLES }
  Cannot modify own account: $id === auth()->id() → 403.
  If demoting FROM super_admin AND lastSuperAdmin($id): 422 with message
    "Cannot demote the last active super_admin. Promote another admin first."
  PlatformAuditService::record(action:'admin_user.role_changed',
    oldValue:['role'=>$old], newValue:['role'=>$new])

UPDATESTATUS: validate { is_active: boolean }
  Cannot deactivate own account: 403.
  If deactivating super_admin AND lastSuperAdmin($id): 422 with message
    "Cannot deactivate the last active super_admin."
  PlatformAuditService::record(action:'admin_user.status_changed')

git add . && git commit -m "feat(cc-phase3-task5): admin user management routes"

═══════════════════════════════════════════════════════════
TASK 6 — SYSTEM ANNOUNCEMENTS ROUTES
═══════════════════════════════════════════════════════════

Create: app/Http/Controllers/Api/Platform/AnnouncementController.php

Add platform routes (auth required):
  Route::get('/announcements', [AnnouncementController::class, 'index']);
  Route::post('/announcements', [AnnouncementController::class, 'store']);
  Route::patch('/announcements/{id}', [AnnouncementController::class, 'update']);
  Route::delete('/announcements/{id}', [AnnouncementController::class, 'destroy']);

Role for mutations: super_admin and admin. Others: 403.
Audit all mutations.

Add PUBLIC tenant route in routes/api.php (no auth required — tenant web admin reads this):
  Route::get('/v1/system/announcements', [SystemAnnouncementController::class, 'publicIndex']);
  Returns only: is_active=true, within starts_at/ends_at window.
  Fields: id, title, message, type.

git add . && git commit -m "feat(cc-phase3-task6): system announcement routes"

═══════════════════════════════════════════════════════════
TASK 7 — TESTS: PHASE 3 API
═══════════════════════════════════════════════════════════

Create tests/Feature/Platform/AutomationTest.php:
  - CRUD happy paths, all write audit log entries
  - 403 for support, billing, readonly roles on mutations
  - No /automations/{id}/run endpoint exists (verify route:list)
  - Invalid JSON string in trigger_conditions_json → 422

Create tests/Feature/Platform/AdminUserManagementTest.php:
  - Cannot create admin with role='super_admin' via store → 422
  - Cannot update own role → 403
  - Cannot deactivate own account → 403
  - Demote last super_admin → 422 with correct message
  - Deactivate last super_admin → 422 with correct message
  - All routes: 403 for non-super_admin platform admins
  - All routes: 403 for tenant token

Create tests/Feature/Platform/PlatformConfigTest.php:
  - GET /config returns all seeded keys
  - PUT /config/platform_name by super_admin → updates + audit log
  - PUT /config/platform_name by admin → 403
  - 403 tenant token

Create tests/Feature/Platform/AnnouncementTest.php:
  - CRUD by super_admin and admin → audit logged
  - 403 for support/billing/readonly on mutations
  - GET /api/v1/system/announcements (public) returns only active in-window announcements

./vendor/bin/pest tests/Feature/Platform/
All green before committing.

git add . && git commit -m "feat(cc-phase3-task7): phase 3 API tests"
```

**Merge Phase 3 API:**
```bash
git push origin cc/phase-3-api
# Open PR → merge to main
git checkout main && git pull
```

---

## Phase 3 — Frontend

```bash
cd wayfield/command
git checkout main && git pull
git checkout -b cc/phase-3-frontend
```

**Run in:** `cd wayfield/command && claude`

```
You are building CC-Web Phase 3: Automations, Security Events, Audit Log,
Announcements, and Settings.

Read before writing:
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md

Announcements is a nav item in the System group (not inside Settings).
Settings is super_admin only.

═══════════════════════════════════════════════════════════
PART 1 — AUTOMATIONS
═══════════════════════════════════════════════════════════

File: app/(admin)/automations/page.tsx
Role guard: if (!can.manageAutomations(adminUser.role)) redirect('/')

ENGINE NOTICE — always at top, not dismissible, not closeable:
  bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6
  Zap (amber-500 20px) + "Automation execution engine is not yet implemented.
  Rules created here will not execute automatically until the engine is built."

FILTER BAR: org selector | trigger_type dropdown | status (All/Active/Inactive)

TABLE: Organisation (link) | Rule Name | Trigger (font-mono badge) |
  Action (font-mono badge) | Active toggle | Last Run | Edit | Delete

Active toggle: super_admin and admin only. Others: text badge.
  On toggle: PATCH {id} {is_active: !current}. No confirmation needed.

"+ New Rule" button: opens RuleEditorSlideOver in create mode.
Edit button: opens RuleEditorSlideOver in edit mode.
Delete button: opens ConfirmModal (destructive, coral red confirm).

RULE EDITOR SLIDE-OVER:
  Fields: Organisation (required), Rule Name, Trigger Type dropdown,
  Trigger Conditions (JSON textarea 6 rows — validate JSON on blur, show inline error if invalid),
  Action Type dropdown, Action Config (JSON textarea — same validation), Active toggle.
  Save: POST or PATCH. Loading state. On success: close, refresh, toast.
  No "Run Now" button anywhere.

git add . && git commit -m "feat(cc-web-phase3-part1): automations page"

═══════════════════════════════════════════════════════════
PART 2 — SECURITY EVENTS
═══════════════════════════════════════════════════════════

File: app/(admin)/security/page.tsx
Visible to super_admin, admin, support (redirect others to /)

FILTER BAR: severity multi-select | event_type | date_from | date_to

SEVERITY BADGES (color + text label — never color alone):
  low: gray, medium: bg-blue-50 text-blue-700, high: bg-amber-50 text-amber-700,
  critical: bg-red-50 text-red-700

TABLE: Date/Time | Org | User | Event Type (font-mono badge) | Severity badge | Description
Expandable row: metadata_json pretty-printed (JSON.stringify, null, 2).
Read only. No actions.

EMPTY STATE (with filtering active): "No security events match your filters."
EMPTY STATE (no filters): Shield icon + "No security events recorded." gray-400

git add . && git commit -m "feat(cc-web-phase3-part2): security events page"

═══════════════════════════════════════════════════════════
PART 3 — AUDIT LOG
═══════════════════════════════════════════════════════════

File: app/(admin)/audit/page.tsx
Role guard: if (!can.viewAuditLog(adminUser.role)) redirect('/')

NOTE at top: font-mono text-xs text-gray-400
  "Reads platform_audit_logs — platform admin actions only, not tenant events."

FILTER BAR: admin user dropdown | org search | action text input | date_from | date_to

TABLE: Date/Time | Admin | Organisation | Action (teal font-mono badge) | Entity | Expand

EXPANDABLE ROW (full width, bg-gray-50 px-6 py-4):
  Three sections — Previous Value | New Value | Metadata
  Each: label (font-mono text-xs uppercase gray-500) +
    code block (bg-white border border-gray-200 rounded-lg px-4 py-3
      font-mono text-xs gray-700 overflow-x-auto max-h-48 overflow-y-auto)
  Value: JSON.stringify(parsed, null, 2) or "None" if null

EXPORT BUTTON ("Export CSV" top-right, Download icon):
  GET /api/platform/v1/audit-logs/export with current filters → download file.
  If endpoint not yet built: show toast "Export not yet available."

Pagination: 50 per page.

git add . && git commit -m "feat(cc-web-phase3-part3): audit log page"

═══════════════════════════════════════════════════════════
PART 4 — ANNOUNCEMENTS
═══════════════════════════════════════════════════════════

File: app/(admin)/announcements/page.tsx
Visible to super_admin and admin. Mutations for these roles only.
(Announcements is in System nav group per NAVIGATION_SPEC.md)

TABLE: Title | Type badge | Status badge | Starts | Ends | Created By | Actions
Type badges: info=bg-blue-50 text-blue-700, warning=bg-amber-50 text-amber-700,
  critical=bg-red-50 text-red-700
Active row: teal left border (border-l-2 border-teal-400)
Expired row: opacity-60

"Create Announcement" button top-right.
Actions: Edit | Deactivate (for active) | Delete (with ConfirmModal)

CREATE/EDIT MODAL:
  Title input, Message textarea, Type radio (Info/Warning/Critical with color preview),
  Starts At datetime input (optional), Ends At datetime input (optional),
  Active toggle.
  PREVIEW BOX below form: shows how the banner looks with correct bg/text color.

git add . && git commit -m "feat(cc-web-phase3-part4): announcements page"

═══════════════════════════════════════════════════════════
PART 5 — SETTINGS
═══════════════════════════════════════════════════════════

File: app/(admin)/settings/page.tsx
Role guard: if (adminUser.role !== 'super_admin') redirect('/')

TWO SECTIONS:

SECTION 1 — PLATFORM CONFIGURATION:
  H2 "Platform Configuration"
  Fetch: GET /api/platform/v1/config
  Each config row: bg-white rounded-xl border border-gray-200 px-6 py-4 flex items-center
    Left: config_key (font-mono text-sm gray-900) + description (text-xs gray-500 mt-0.5)
    Right: current value (font-mono text-sm gray-700 mr-4) + Edit button
  Edit: inline — replaces value with input + Save (teal) + Cancel (gray) buttons min-h-[44px]
    PUT /api/platform/v1/config/{key} { value }
    On success: update display, toast. On error: inline error, stay in edit mode.

SECTION 2 — PLATFORM ADMIN USERS:
  H2 "Platform Admins" + "+ Invite Admin" button top-right
  Table: Name | Email | Role badge | Status badge | Last Login | Edit Role | Deactivate
  Deactivate: hidden for own account row
  Last super_admin: Deactivate button disabled with tooltip "Cannot deactivate last super_admin"

  INVITE MODAL:
    First name, Last name, Email, Role dropdown (admin/support/billing/readonly — NOT super_admin)
    "Invite" or "Create Account" button. On success: refresh list, toast.

  EDIT ROLE MODAL:
    Current role badge displayed.
    Role dropdown: all 5 roles.
    If target IS last super_admin: super_admin option in dropdown has note
      "(Cannot demote — last super_admin)" and is visually muted but not hidden.
    PATCH /api/platform/v1/admins/{id}/role
    On 422 from API: show error INSIDE modal — do not close modal, do not show toast.
    Error text: "Cannot demote the last active super_admin. Promote another admin first."

  DEACTIVATE MODAL (ConfirmModal destructive):
    PATCH /api/platform/v1/admins/{id}/status { is_active: false }
    On 422: show error inside modal.

git add . && git commit -m "feat(cc-web-phase3-part5): settings page"

═══════════════════════════════════════════════════════════
PART 6 — TESTS: PHASE 3 FRONTEND
═══════════════════════════════════════════════════════════

  - Automations engine notice always visible, cannot be dismissed
  - No "Run Now" button exists anywhere on the automations page
  - JSON textarea shows inline error on invalid JSON
  - /security shows severity badges with both color and text label (never color alone)
  - Audit log reads from platform_audit_logs (API endpoint: /audit-logs)
  - Audit log expandable row shows all three JSON sections
  - /settings redirects admin/support/billing/readonly to /
  - Edit Role 422: error shown inside modal, modal stays open
  - Deactivate: own account row has no Deactivate button
  - Invite modal: super_admin absent from role dropdown
  - Announcements: type preview shows correct color in modal
  - Platform config inline edit: shows error inline, stays in edit mode on API error

git add . && git commit -m "feat(cc-web-phase3-part6): phase 3 frontend tests"
```

**Merge Phase 3 Frontend:**
```bash
git push origin cc/phase-3-frontend
# Open PR → merge to main
git checkout main && git pull
```

---

# PHASE 4
# Support Tickets + AI Operations Layer

---

## Phase 4 — API

```bash
cd wayfield/api
git checkout main && git pull
git checkout -b cc/phase-4-api
```

**Run in:** `cd wayfield/api && claude`

```
You are building the Wayfield Command Center Phase 4 API:
the integrated support ticket system with AI classification and response drafting,
plus the onboarding intelligence and daily ops brief.

Read before writing:
@../docs/command_center/SUPPORT_AND_AI_OPS_PLAN.md
@../docs/command_center/COMMAND_CENTER_SCHEMA.md

NON-NEGOTIABLE:
  Route prefix: /api/platform/v1/
  Tenant intake: /api/v1/support/tickets (auth:sanctum)
  Guard on platform routes: auth:platform_admin + platform.auth
  PlatformAuditService::record() on every platform mutation
  AI calls: model from config('services.anthropic.model') — never hardcoded
  AI context: strip phone numbers, meeting URLs, addresses via sanitizeForAI()
  Auto-send: ALWAYS false in Phase A. Hardcoded, not configurable yet.

═══════════════════════════════════════════════════════════
TASK 1 — SCHEMA: SUPPORT AND AI TABLES
═══════════════════════════════════════════════════════════

Check all tables:
  php artisan tinker --execute="
    foreach(['support_tickets','support_messages','support_ai_suggestions',
             'support_escalations','ai_knowledge_sources','ai_action_logs',
             'ai_daily_ops_reports','ai_onboarding_actions'] as \$t)
      echo \$t.': '.(Schema::hasTable(\$t)?'EXISTS':'MISSING').PHP_EOL;"

Create MISSING tables. Full schema in SUPPORT_AND_AI_OPS_PLAN.md Part 1.
Summary:

  support_tickets: id, user_id null, organization_id null, source ENUM(web_form,email,in_app),
    subject VARCHAR(500), status ENUM(open,classifying,draft_ready,pending_review,resolved,closed),
    priority ENUM(low,normal,high,urgent), category ENUM(billing,access,bug,feature,
    onboarding,leader_flow,participant_flow,general) null, ai_classification null,
    ai_confidence DECIMAL(5,4) null, escalation_required BOOLEAN DEFAULT false,
    escalation_type ENUM(billing,legal,privacy,access,abuse,bug) null,
    assigned_admin_id null, resolved_at null, timestamps.
    INDEX: status, user_id, organization_id, priority+status, created_at

  support_messages: id, ticket_id FK CASCADE, sender_type ENUM(user,admin,ai_draft),
    sender_id null, message_body TEXT, is_sent BOOLEAN DEFAULT false,
    sent_at DATETIME null, created_at.

  support_ai_suggestions: id, ticket_id FK CASCADE, suggested_response TEXT,
    confidence_score DECIMAL(5,4) null, auto_send_eligible BOOLEAN DEFAULT false,
    approved_by_admin_id null, approved_at null, sent_at null, created_at.

  support_escalations: id, ticket_id FK CASCADE, escalation_reason TEXT,
    escalation_type ENUM(billing,legal,privacy,access,abuse,bug,other),
    ai_summary TEXT null, status ENUM(open,in_review,resolved) DEFAULT open,
    timestamps.

  ai_knowledge_sources: id, source_type ENUM(faq,guide,policy,product,
    pricing,permissions,troubleshooting), title VARCHAR(500), content TEXT,
    tags JSON null, version INT DEFAULT 1, is_approved BOOLEAN DEFAULT false,
    approved_by_admin_id null, timestamps. INDEX: source_type, is_approved.

  ai_action_logs: id, action_type ENUM(ticket_classification,response_draft,
    escalation_decision,onboarding_nudge,daily_ops_report,workshop_readiness),
    entity_type null, entity_id null, input_summary TEXT null,
    output_summary TEXT null, confidence DECIMAL(5,4) null, model_used null,
    tokens_used INT null, outcome ENUM(success,failed,escalated,skipped),
    error_message TEXT null, created_at. (No updated_at — immutable log)
    INDEX: action_type, entity+id, created_at.

  ai_daily_ops_reports: id, report_date DATE UNIQUE, raw_data_json JSON,
    ai_summary TEXT, recommended_actions JSON null, generated_at DATETIME, created_at.

  ai_onboarding_actions: id, user_id FK, organization_id null,
    trigger_event VARCHAR(100), message TEXT, action_type ENUM(email,in_app),
    sent_at null, completed_at null, created_at.
    INDEX: user_id, trigger_event, sent_at.

  php artisan migrate

git add . && git commit -m "feat(cc-phase4-task1): create support and AI operations tables"

═══════════════════════════════════════════════════════════
TASK 2 — ANTHROPIC CONFIG
═══════════════════════════════════════════════════════════

Add to config/services.php:
  'anthropic' => [
    'api_key' => env('ANTHROPIC_API_KEY'),
    'model'   => env('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'),
  ],

Add to .env and .env.example:
  ANTHROPIC_API_KEY=sk-ant-your-key-here
  ANTHROPIC_MODEL=claude-sonnet-4-20250514
  AI_SUPPORT_QUEUE=support

Add data sanitization service at app/Services/Platform/AiDataSanitizer.php:

<?php
declare(strict_types=1);
namespace App\Services\Platform;

class AiDataSanitizer
{
    private const FORBIDDEN_KEYS = [
        'phone_number','phone','address_line_1','address_line_2','postal_code',
        'meeting_url','meeting_id','meeting_passcode','password','password_hash',
        'remember_token','stripe_customer_id','bank_account','tax_id','card_number',
    ];

    public static function sanitize(array $data): array
    {
        array_walk_recursive($data, function (&$value, $key) {
            if (in_array(strtolower((string)$key), self::FORBIDDEN_KEYS, true)) {
                $value = '[REDACTED]';
            }
        });
        return $data;
    }
}

git add . && git commit -m "feat(cc-phase4-task2): Anthropic config and AiDataSanitizer"

═══════════════════════════════════════════════════════════
TASK 3 — TENANT TICKET INTAKE ENDPOINT
═══════════════════════════════════════════════════════════

Add to routes/api.php (inside /v1 prefix, auth:sanctum):
  Route::post('/support/tickets', [SupportTicketController::class, 'store']);
  Route::get('/support/tickets/{id}', [SupportTicketController::class, 'show']);

Create: app/Http/Controllers/Api/SupportTicketController.php

store():
  Auth: auth:sanctum (tenant user — not platform admin)
  Validate: { subject: required|max:500, message: required|min:10|max:5000,
    category_hint: nullable|in:billing,access,bug,feature,onboarding,general }
  Create support_ticket: user_id=auth()->id(), organization_id from user's primary org
  Create support_message: sender_type=user, message_body=request->message, is_sent=true
  Dispatch ClassifySupportTicketJob to 'support' queue
  Return 201: { ticket_id, status:'open', message:'Your request has been received.' }

show():
  Only the submitting user can see their ticket ($ticket->user_id === auth()->id())
  Return: { id, subject, status, created_at }

git add . && git commit -m "feat(cc-phase4-task3): tenant ticket intake endpoint"

═══════════════════════════════════════════════════════════
TASK 4 — CLASSIFY SUPPORT TICKET JOB
═══════════════════════════════════════════════════════════

Create: app/Jobs/Support/ClassifySupportTicketJob.php
Queue: 'support' (or default if support queue not configured)

handle():
  1. Load ticket with user and organization
  2. Load approved ai_knowledge_sources (is_approved=true, limit 20 most recent)
  3. Build knowledge context (each source: title + first 300 chars of content)
  4. Build sanitized context array via AiDataSanitizer::sanitize()
  5. Call Anthropic API:
     POST https://api.anthropic.com/v1/messages
     Headers: x-api-key: config('services.anthropic.api_key')
              anthropic-version: 2023-06-01
              content-type: application/json
     Body: {
       model: config('services.anthropic.model'),
       max_tokens: 500,
       system: "You are a support ticket classifier for Wayfield, a photography
                workshop management SaaS. Classify the ticket.
                Return JSON only. No preamble. No markdown.
                Return: { category: string, priority: string,
                  escalation_required: bool, escalation_type: string|null,
                  ai_classification: string, confidence: float }
                Categories: billing,access,bug,feature,onboarding,
                  leader_flow,participant_flow,general
                Priorities: low,normal,high,urgent
                escalation_required=true if: billing dispute, payment mention,
                  account locked, privacy concern, suspected bug, abusive language,
                  legal reference, negative + access combined.
                escalation_type must be set when escalation_required=true.",
       messages: [{ role:'user',
         content: 'Subject: {subject}\nMessage: {message}\n\nUser plan: {plan}\nKnowledge:\n{kb}' }]
     }
  6. Parse JSON from response.content[0].text
  7. Update support_ticket fields (category, priority, escalation_required etc.)
  8. Set status: escalation_required ? 'pending_review' : 'draft_ready'
  9. If escalation_required: create support_escalation record
  10. Log to ai_action_logs (action_type='ticket_classification', outcome='success'/'failed')
  11. If not escalating: dispatch GenerateSupportResponseJob

  Error handling: if Anthropic call fails or JSON parse fails:
    Set ticket status='pending_review' (fall back to human)
    Log to ai_action_logs (outcome='failed', error_message=exception message)
    Do NOT re-throw. Silently handle so ticket is not lost.

git add . && git commit -m "feat(cc-phase4-task4): ClassifySupportTicketJob"

═══════════════════════════════════════════════════════════
TASK 5 — GENERATE SUPPORT RESPONSE JOB
═══════════════════════════════════════════════════════════

Create: app/Jobs/Support/GenerateSupportResponseJob.php
Queue: 'support'

handle():
  1. Load ticket with messages and organization
  2. Load approved ai_knowledge_sources filtered by category tags (or all if no match)
  3. Call Anthropic API:
     system: "You are a helpful support agent for Wayfield, a photography
              workshop management SaaS. Write a clear, friendly, concise reply.
              Rules: under 200 words unless complexity requires more.
              Never promise specific timelines. Never make billing/refund decisions.
              Never mention participant phone numbers or private addresses.
              If the answer is not in the knowledge base, say you will look into it.
              End with: 'Let me know if you have any other questions.'
              Return reply text only. No JSON. No preamble."
     user: "Subject: {subject}\nMessage: {message}\nCategory: {category}\nPlan: {plan}\n\nKnowledge:\n{kb}"
  4. auto_send_eligible = FALSE (hardcoded — Phase A)
  5. Create support_ai_suggestion record
  6. Update ticket status = 'draft_ready'
  7. Log to ai_action_logs

git add . && git commit -m "feat(cc-phase4-task5): GenerateSupportResponseJob"

═══════════════════════════════════════════════════════════
TASK 6 — PLATFORM TICKET MANAGEMENT ROUTES
═══════════════════════════════════════════════════════════

Create: app/Http/Controllers/Api/Platform/SupportController.php

Add to routes/platform.php:
  Route::get('/support/tickets', [SupportController::class, 'index']);
  Route::get('/support/tickets/{id}', [SupportController::class, 'show']);
  Route::post('/support/tickets/{id}/approve', [SupportController::class, 'approve']);
  Route::post('/support/tickets/{id}/reply', [SupportController::class, 'reply']);
  Route::post('/support/tickets/{id}/escalate', [SupportController::class, 'escalate']);
  Route::post('/support/tickets/{id}/resolve', [SupportController::class, 'resolve']);
  Route::get('/support/knowledge', [KnowledgeController::class, 'index']);
  Route::post('/support/knowledge', [KnowledgeController::class, 'store']);
  Route::patch('/support/knowledge/{id}', [KnowledgeController::class, 'update']);
  Route::delete('/support/knowledge/{id}', [KnowledgeController::class, 'destroy']);
  Route::get('/support/ai-log', [SupportController::class, 'aiLog']);
  Route::get('/daily-brief', [DailyBriefController::class, 'show']);
  Route::post('/daily-brief/generate', [DailyBriefController::class, 'generate']);
  Route::get('/onboarding-actions', [OnboardingController::class, 'index']);

TICKET INDEX: paginated 25/page. Filters: status, priority, escalation_required, date_from.
  Response per ticket: { id, subject, status, priority, category, escalation_required,
    ai_confidence, user_name, organization_name, created_at }

TICKET SHOW: ticket + messages[] + latest ai_suggestion + escalations[]

APPROVE: Request { edited_response?: string }
  Use ai_suggestion.suggested_response or edited_response if provided.
  Create support_message (sender_type='admin', is_sent=true, sent_at=now()).
  Update suggestion: approved_by_admin_id, approved_at, sent_at.
  Update ticket: status='resolved', resolved_at=now().
  Send email to user via SES (use existing notification/email system).
  PlatformAuditService::record(action:'support_ticket.response_sent')

REPLY: Request { message: required }
  Create support_message (sender_type='admin', is_sent=true).
  Update ticket: status='resolved'.
  Send email to user. PlatformAuditService::record(action:'support_ticket.manual_reply')

ESCALATE: Request { escalation_type, reason }
  Create support_escalation. Set ticket.escalation_required=true, status='pending_review'.
  PlatformAuditService::record(action:'support_ticket.escalated')

RESOLVE: Update status='resolved', resolved_at=now().
  PlatformAuditService::record(action:'support_ticket.resolved')

KNOWLEDGE CRUD: standard CRUD with approve action (is_approved toggle).
  Approving: is_approved=true, approved_by_admin_id=admin->id. Audit all changes.

AI LOG: GET /support/ai-log — paginated ai_action_logs, filter by action_type, date.

DAILY BRIEF (GET): latest ai_daily_ops_reports or today's. Include status='not_generated' if none.
DAILY BRIEF (POST generate): dispatch GenerateDailyOpsReportJob immediately.

ONBOARDING: GET ai_onboarding_actions paginated, filter trigger_event and completed status.

git add . && git commit -m "feat(cc-phase4-task6): platform support and ops routes"

═══════════════════════════════════════════════════════════
TASK 7 — DAILY OPS REPORT JOB
═══════════════════════════════════════════════════════════

Create: app/Jobs/Ops/GenerateDailyOpsReportJob.php

Schedule at 06:00 UTC in routes/console.php or Kernel.php.

handle():
  1. Check if report already generated for today — skip if exists
  2. Gather data: org counts, user metrics, workshop counts, support ticket summary,
     failed_jobs count, queue depth, AI action log stats from last 24h
  3. Sanitize via AiDataSanitizer::sanitize() before sending to API
  4. Call Anthropic API:
     system: "You are the operations intelligence layer for Wayfield.
              Write a concise daily brief for the solo founder.
              Return JSON only:
              { summary: string, highlights: [string], concerns: [string],
                recommended_actions: [{action, priority, reason}] }"
     user: JSON.stringify(gathered_data)
  5. Store in ai_daily_ops_reports
  6. Log to ai_action_logs

git add . && git commit -m "feat(cc-phase4-task7): GenerateDailyOpsReportJob with scheduler"

═══════════════════════════════════════════════════════════
TASK 8 — TESTS: PHASE 4 API
═══════════════════════════════════════════════════════════

Create tests/Feature/Platform/SupportTicketTest.php:
  - POST /api/v1/support/tickets → 201 + ticket_id, dispatches ClassifySupportTicketJob
  - POST /api/v1/support/tickets without auth → 401
  - GET /api/v1/support/tickets/{id} by submitting user → 200
  - GET /api/v1/support/tickets/{id} by different user → 403
  - GET /api/platform/v1/support/tickets with platform token → 200
  - GET /api/platform/v1/support/tickets with tenant token → 403
  - POST .../approve → creates message + updates suggestion + logs audit
  - POST .../reply → creates message + logs audit

Create tests/Unit/AiDataSanitizerTest.php:
  - phone_number field: value replaced with '[REDACTED]'
  - meeting_url field: value replaced with '[REDACTED]'
  - address_line_1: replaced
  - password: replaced
  - Safe fields (name, email, title): not modified

Create tests/Feature/Platform/DailyBriefTest.php:
  - GET /daily-brief with no report → { status: 'not_generated' }
  - POST /daily-brief/generate → dispatches GenerateDailyOpsReportJob

./vendor/bin/pest tests/Feature/Platform/
./vendor/bin/pest tests/Unit/AiDataSanitizerTest.php

git add . && git commit -m "feat(cc-phase4-task8): phase 4 API tests"
```

**Merge Phase 4 API:**
```bash
git push origin cc/phase-4-api
# Open PR → merge to main
git checkout main && git pull
```

---

## Phase 4 — Frontend

```bash
cd wayfield/command
git checkout main && git pull
git checkout -b cc/phase-4-frontend
```

**Run in:** `cd wayfield/command && claude`

```
You are building CC-Web Phase 4: Support Ticket Inbox, Knowledge Base,
AI Log, Daily Brief, and Onboarding Intelligence.

Read before writing:
@../docs/command_center/SUPPORT_AND_AI_OPS_PLAN.md
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md

AI CONFIDENCE DISPLAY:
  ≥ 90%: text-teal-600 bg-teal-50 (Phase B: eligible for auto-send)
  70–89%: text-amber-600 bg-amber-50 (review carefully)
  < 70%: text-red-600 bg-red-50 (AI unsure — manual response)
  null: "Classifying..." text-gray-400

Also add to NAVIGATION_SPEC.md sidebar:
  Support section: Tickets (/support/tickets), Knowledge (/support/knowledge), AI Log (/support/ai-log)
  (These replace the simple /support external-link screen from Phase 2 — update the nav item)
  Operations section: Daily Brief (/daily-brief), Onboarding (/onboarding)

═══════════════════════════════════════════════════════════
PART 1 — UPDATE SIDEBAR NAVIGATION
═══════════════════════════════════════════════════════════

Update Sidebar.tsx:
  Replace single { href:'/support', icon:MessageCircle, label:'Support' } item
  with three items (all gated to can.viewSupport):
    { href:'/support/tickets',   icon:MessageSquare, label:'Tickets' }
    { href:'/support/knowledge', icon:Library,       label:'Knowledge Base' }
    { href:'/support/ai-log',    icon:Bot,           label:'AI Log' }

  Add to Operations group:
    { href:'/daily-brief', icon:FileText, label:'Daily Brief' }
    { href:'/onboarding',  icon:Rocket,   label:'Onboarding' }

Both new Operations items: visible to super_admin and admin.
The /support/* items: visible to can.viewSupport (super_admin, admin, support).

git add . && git commit -m "feat(cc-web-phase4-part1): update sidebar with support and ops nav"

═══════════════════════════════════════════════════════════
PART 2 — TICKET INBOX
═══════════════════════════════════════════════════════════

File: app/(admin)/support/tickets/page.tsx
Role guard: if (!can.viewSupport(adminUser.role)) redirect('/')
API: GET /api/platform/v1/support/tickets

TABS (status-based): Open | Draft Ready | Escalated | Resolved
  "Escalated" = escalation_required=true AND status != resolved.

TABLE: Subject | User | Org | Priority badge | Category | AI Confidence | Age | View

AI CONFIDENCE CELL:
  ≥ 90%: "{pct}%" teal
  70–89%: "{pct}%" amber
  < 70%: "{pct}%" red
  null: "Classifying..." gray-400 animate-pulse

ESCALATED TAB — amber alert banner at top:
  "{count} tickets require your attention"

VIEW: navigates to /support/tickets/{id}

git add . && git commit -m "feat(cc-web-phase4-part2): support ticket inbox"

═══════════════════════════════════════════════════════════
PART 3 — TICKET DETAIL PAGE
═══════════════════════════════════════════════════════════

File: app/(admin)/support/tickets/[id]/page.tsx
API: GET /api/platform/v1/support/tickets/{id}

TWO-COLUMN LAYOUT (60/40):

LEFT — CONVERSATION THREAD:
  Messages rendered oldest → newest.
  User messages: left-aligned, gray-100 bg, user name + timestamp above
  Admin messages: right-aligned, teal-50 bg, "You" or admin name + timestamp

  AI DRAFT CARD (shown when ai_suggestion exists and ticket not resolved):
    bg-white border-2 border-[#0FA3B1] rounded-xl p-5 mt-4
    Header: "AI Draft Response" (font-heading text-sm font-semibold teal) +
      confidence badge (right-aligned) +
      classification slug (font-mono text-xs gray-400)
    Body: ai_suggestion.suggested_response (font-sans text-sm gray-700)
    Footer (flex gap-3 mt-4):
      "Approve & Send" (bg-[#0FA3B1] text-white, min-h-[44px], primary)
      "Edit & Send" (border border-[#0FA3B1] text-[#0FA3B1], min-h-[44px])
      "Write My Own" (text-gray-500, min-h-[44px])

  EDIT & SEND FLOW:
    Reveals textarea pre-filled with ai_suggestion.suggested_response.
    Admin edits. "Send Response" button: POST .../approve { edited_response }

  WRITE MY OWN FLOW:
    Shows blank textarea. "Send Response": POST .../reply { message }

  ESCALATION CARD (shown when escalation_required=true and no draft):
    bg-amber-50 border border-amber-300 rounded-xl p-5 mt-4
    "Escalation Required" heading (amber-800)
    escalation_type badge + ai_summary text
    "Write Response" button (opens manual textarea)

RIGHT — METADATA CARD (bg-white rounded-xl border border-gray-200 shadow-sm p-6):
  Ticket #{id} (font-mono text-xs gray-400)
  Status badge, Priority badge, Category badge
  AI Classification: font-mono text-xs bg-gray-50 px-2 py-1 rounded
  AI Confidence: colored percentage
  Submitted: relative timestamp
  User: name + email (link to /users page with search pre-filled)
  Organisation: name (link to /organizations/{id})
  Plan: PlanBadge

  ACTIONS (mt-6 flex flex-col gap-2):
    "Escalate" (amber outline, min-h-[44px]) → escalation modal
    "Mark Resolved" (gray outline, min-h-[44px]) → POST .../resolve
    (Hide actions if status=resolved)

APPROVE ACTION: POST .../approve, loading state, show success, redirect to inbox.
SUCCESS TOAST: "Response sent — ticket resolved."

git add . && git commit -m "feat(cc-web-phase4-part3): ticket detail with AI draft review"

═══════════════════════════════════════════════════════════
PART 4 — KNOWLEDGE BASE
═══════════════════════════════════════════════════════════

File: app/(admin)/support/knowledge/page.tsx

Filter: source_type dropdown + approval toggle (All/Approved/Pending)

TABLE: Title | Type | Approved | Version | Updated | Actions (Edit, Approve, Delete)
Approved badge: teal "Approved" or amber "Pending Review"
Approve button: only shown for is_approved=false rows. PATCH { is_approved: true }

"Add Article" button → modal:
  source_type dropdown, title input, content textarea (large, 12 rows),
  tags input (comma-separated), approve checkbox
  POST /api/platform/v1/support/knowledge

Edit: same modal pre-filled. PATCH.
Delete: ConfirmModal.

Note at top: "Only approved articles are used by the AI when drafting responses."

git add . && git commit -m "feat(cc-web-phase4-part4): knowledge base management"

═══════════════════════════════════════════════════════════
PART 5 — AI ACTION LOG
═══════════════════════════════════════════════════════════

File: app/(admin)/support/ai-log/page.tsx

Filter: action_type dropdown | date_from | date_to

TABLE: Date/Time | Action Type (font-mono badge) | Entity | Confidence | Outcome | Details

Action type badges: ticket_classification=teal, response_draft=blue, escalation_decision=amber,
  onboarding_nudge=purple, daily_ops_report=gray

Outcome: success=teal, failed=red, escalated=amber, skipped=gray

Details: expandable row showing input_summary and output_summary (text, not JSON).

Note at top: "Immutable log of all AI decisions. Entries are never deleted."

git add . && git commit -m "feat(cc-web-phase4-part5): AI action log viewer"

═══════════════════════════════════════════════════════════
PART 6 — DAILY BRIEF
═══════════════════════════════════════════════════════════

File: app/(admin)/daily-brief/page.tsx
Role guard: super_admin and admin only.
API: GET /api/platform/v1/daily-brief

IF REPORT EXISTS:
  Report date + generated time (font-mono text-xs gray-400 top-right)

  SUMMARY CARD (bg-white rounded-xl border border-gray-200 shadow-sm p-6):
    "Today's Brief" (Sora 18px font-semibold gray-900)
    ai_summary rendered in Plus Jakarta Sans 15px gray-700 leading-relaxed

  RECOMMENDED ACTIONS (mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-6):
    "Recommended Actions" heading
    Numbered list: each with action text + priority badge + reason (gray-500)
    priority: high=red badge, normal=amber badge, low=gray badge

  HIGHLIGHTS (if any): bulleted green-tinted list
  CONCERNS (if any): bulleted amber-tinted list

  "Raw Data" collapsible (ChevronDown toggle):
    JSON of raw_data_json in font-mono text-xs bg-gray-50 rounded-lg p-4 overflow-x-auto

IF NO REPORT (status='not_generated'):
  "Today's brief hasn't been generated yet."
  "Generate Now" button (teal, min-h-[44px])
    POST /daily-brief/generate → polls GET /daily-brief every 5s → renders when ready
    Loading: "Generating brief..." with Loader2 animate-spin

DATE NAV: Previous/Next day arrows for historical briefs.

git add . && git commit -m "feat(cc-web-phase4-part6): daily brief page"

═══════════════════════════════════════════════════════════
PART 7 — ONBOARDING INTELLIGENCE
═══════════════════════════════════════════════════════════

File: app/(admin)/onboarding/page.tsx
API: GET /api/platform/v1/onboarding-actions

SUMMARY CARD: completion rate stat (completed_at not null / total)

FILTER BAR: trigger_event dropdown | completed toggle (All/Completed/Pending)

TABLE: User | Org | Trigger Event (font-mono badge) | Message preview | Sent At | Completed At

Trigger event badge colors:
  account_created: teal
  workshop_draft_48h/7d: orange
  leader_invite_pending_72h: amber
  sessions_missing/logistics_missing: red
  workshop_ready_to_publish: purple
  first_registration: green

Completed At: CheckCircle (teal) if set, else "—"

git add . && git commit -m "feat(cc-web-phase4-part7): onboarding intelligence page"

═══════════════════════════════════════════════════════════
PART 8 — TESTS: PHASE 4 FRONTEND
═══════════════════════════════════════════════════════════

  - Ticket list confidence badge shows correct color for each range
  - Ticket list null confidence shows "Classifying..." with animate-pulse
  - Escalated tab shows amber banner with count
  - Ticket detail: AI draft card only shows when suggestion exists and not resolved
  - "Approve & Send" POST /approve, loading state, redirect to inbox on success
  - "Write My Own" shows blank textarea
  - Escalation card shown when escalation_required=true (no AI draft)
  - Knowledge: "Only approved articles used by AI" note always visible
  - Knowledge: Approve button absent on already-approved rows
  - AI log: expandable row shows input_summary and output_summary
  - Daily Brief: Generate Now polls every 5s and renders when report appears
  - Onboarding: filter by trigger_event works, completion rate stat shows

git add . && git commit -m "feat(cc-web-phase4-part8): phase 4 frontend tests"
```

**Merge Phase 4 Frontend:**
```bash
git push origin cc/phase-4-frontend
# Open PR → merge to main
git checkout main && git pull
```

---

## Final Verification Checklist

Run after all phases are merged to main.

```bash
# Full test suite
cd wayfield/api
./vendor/bin/pest
# Expected: all green, no skipped

# Frontend build
cd wayfield/command
npm run build
# Expected: zero TypeScript errors, zero warnings

# Route audit
cd wayfield/api
php artisan route:list | grep "v1/platform"
# Expected: ZERO rows — no routes at wrong prefix

php artisan route:list | grep "platform/v1"
# Expected: 40+ routes at correct prefix
```

**Browser smoke test checklist:**
```
Authentication
  □ Login with super_admin credentials works
  □ Invalid credentials show error, no redirect
  □ Tenant token returns 403 on /api/platform/v1/overview

Overview
  □ Dark sidebar renders with all nav items for super_admin
  □ Plan distribution chart shows display names (Foundation/Creator/Studio/Enterprise)
  □ Recent activity shows platform_audit_logs entries
  □ Manual refresh button works

Organisation Management
  □ Org list loads, search works, plan filter uses display names
  □ Status badge shows correct color for suspended/active/inactive
  □ Org detail: all 6 tabs render
  □ Plan change modal requires reason, cannot dismiss via backdrop
  □ Plan change logs to platform_audit_logs (verify via Audit tab)
  □ Feature flag toggle works, writes audit entry
  □ Payments tab shows org payment status correctly

Financials & Payments
  □ Staleness notice always visible on Overview and Invoices tabs
  □ Platform payment DISABLE modal: button disabled until "DISABLE" typed
  □ Take rates table shows Foundation/Creator/Studio/Enterprise (not DB codes)
  □ Take rate edit: billing role cannot see Edit button (absent, not disabled)
  □ Stripe Connect tab loads with status counts

Users
  □ User search returns results
  □ Slide-over opens without navigating away
  □ Slide-over closes on backdrop click
  □ Login history shows outcome badges with correct colors

Operations
  □ Automations: engine notice always visible
  □ No "Run Now" button exists anywhere
  □ Security events: severity badges show color + text label
  □ Audit log reads from platform_audit_logs (not audit_logs)
  □ Audit log expandable row shows all 3 JSON sections
  □ Announcements: create works, preview shows correct color
  □ Settings: /settings redirects admin/support/billing/readonly to /
  □ Settings: cannot deactivate own account (button absent)
  □ Settings: last super_admin demotion shows error inside modal
  □ Platform config inline edit works

Support & AI (Phase 4)
  □ Ticket intake works via web admin Help page
  □ Ticket inbox shows correct status tabs
  □ AI draft card renders with confidence badge
  □ Approve & Send sends response and resolves ticket
  □ Knowledge base: only approved articles note visible
  □ Daily Brief: Generate Now polls and renders report
  □ AI Log shows all action types with correct badges

Security
  □ Sign out clears cc_platform_token, redirects to /login
  □ Tenant token returns 403 on any /api/platform/v1/* route
  □ Platform token returns 403 on any /api/v1/* tenant route
  □ Inactive admin cannot log in (422 on login attempt)
  □ Phone number does not appear in any AI prompt (verify via logs)
```

---

## Decision Record — Add to DECISIONS.md

| ID | Decision |
|----|----------|
| DEC-CC-017 | Plan display names in CC UI: Foundation/Creator/Studio/Enterprise. DB codes only in API calls and queries. |
| DEC-CC-018 | Pro plan price is $149/month. All CC screens use this price. |
| DEC-CC-019 | Platform payments_enabled toggle requires type-to-confirm ("DISABLE") in CC UI. |
| DEC-CC-020 | Take rate edits are super_admin only. Billing role can toggle payment flags but not take rates. |
| DEC-CC-021 | Stripe Connect accounts are managed in Stripe Dashboard. CC is read-only for Connect accounts. |
| DEC-CC-022 | Announcements is a standalone nav item in System group — not inside Settings. |
| DEC-CC-023 | platform_take_rates.plan_code uses foundation/creator/studio/custom. subscriptions.plan_code uses free/starter/pro/enterprise. Never conflate. |
| DEC-CC-024 | AI support responses require human approval in Phase A. auto_send_eligible is hardcoded FALSE. |
| DEC-CC-025 | AiDataSanitizer.sanitize() is called before every Anthropic API call. Forbidden fields: phone_number, meeting_url, address_line_1, address_line_2, postal_code, password, stripe_customer_id. |
| DEC-CC-026 | All AI actions logged to ai_action_logs (immutable). Platform admin mutations logged to platform_audit_logs. These are separate tables. |
| DEC-CC-027 | Anthropic model string: config('services.anthropic.model'). Never hardcoded. |
