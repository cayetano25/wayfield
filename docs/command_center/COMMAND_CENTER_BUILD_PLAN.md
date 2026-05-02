# Wayfield Command Center — Complete Build Plan
## docs/command_center/COMMAND_CENTER_BUILD_PLAN.md
## API + Frontend — Phases 0 through 3

> **Status:** API not yet built. Frontend not yet built.
> This document is the authoritative build plan for the entire Command Center.
> Run phases in strict order. API first, then frontend, within each phase.
>
> Before any phase: read
> @../docs/command_center/COMMAND_CENTER_OVERVIEW.md
> @../docs/command_center/NAVIGATION_SPEC.md
> @../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md
> @../docs/command_center/COMMAND_CENTER_SCHEMA.md

---

## Architecture Ground Rules — Read Before Every Session

```
ROUTE PREFIX:     /api/platform/v1/   (NEVER /api/v1/platform/)
AUTH GUARD:       auth:platform_admin (NEVER auth:sanctum on platform routes)
IDENTITY TABLE:   admin_users         (platform_admins is deprecated — never reference it)
AUDIT TABLE:      platform_audit_logs (NEVER audit_logs)
TOKEN STORAGE:    cc_platform_token   (NEVER conflicts with web/ tenant token)
FRONTEND LIBS:    Tailwind + recharts + lucide-react only (NO @tremor/react)
APPLE HIG:        44px touch targets, focus rings, loading/empty/error states on every screen
MUTATIONS:        Every platform admin mutation writes to platform_audit_logs — no exceptions
```

---

## Pre-Flight Diagnostic
### Run this FIRST in `cd wayfield/api` before starting any phase

```
You are running a pre-flight diagnostic for the Wayfield Command Center build.
Do not write any application code yet. Only run commands and report what you find.

Run the following checks in order and report the result of each:

CHECK 1 — admin_users table
  php artisan tinker --execute="echo Schema::hasTable('admin_users') ? 'EXISTS' : 'MISSING';"

CHECK 2 — AdminUser model
  cat app/Models/AdminUser.php 2>/dev/null || echo "FILE NOT FOUND"

CHECK 3 — platform_admin guard in config/auth.php
  php artisan tinker --execute="echo array_key_exists('platform_admin', config('auth.guards')) ? 'EXISTS' : 'MISSING';"

CHECK 4 — routes/platform.php
  ls routes/platform.php 2>/dev/null || echo "FILE NOT FOUND"

CHECK 5 — platform_audit_logs table
  php artisan tinker --execute="echo Schema::hasTable('platform_audit_logs') ? 'EXISTS' : 'MISSING';"

CHECK 6 — EnsurePlatformToken middleware
  cat app/Http/Middleware/EnsurePlatformToken.php 2>/dev/null || echo "FILE NOT FOUND"

CHECK 7 — stripe tables
  php artisan tinker --execute="
    foreach (['stripe_customers','stripe_subscriptions','stripe_invoices','stripe_events'] as \$t)
      echo \$t . ': ' . (Schema::hasTable(\$t) ? 'EXISTS' : 'MISSING') . PHP_EOL;"

CHECK 8 — automation_rules table
  php artisan tinker --execute="echo Schema::hasTable('automation_rules') ? 'EXISTS' : 'MISSING';"

CHECK 9 — security_events table
  php artisan tinker --execute="echo Schema::hasTable('security_events') ? 'EXISTS' : 'MISSING';"

CHECK 10 — platform_config table
  php artisan tinker --execute="echo Schema::hasTable('platform_config') ? 'EXISTS' : 'MISSING';"

CHECK 11 — system_announcements table
  php artisan tinker --execute="echo Schema::hasTable('system_announcements') ? 'EXISTS' : 'MISSING';"

CHECK 12 — feature_flags table (needed for CC Phase 1)
  php artisan tinker --execute="echo Schema::hasTable('feature_flags') ? 'EXISTS' : 'MISSING';"

CHECK 13 — organization_feature_flags table
  php artisan tinker --execute="echo Schema::hasTable('organization_feature_flags') ? 'EXISTS' : 'MISSING';"

CHECK 14 — PlatformAuditService
  cat app/Services/Platform/PlatformAuditService.php 2>/dev/null || echo "FILE NOT FOUND"

CHECK 15 — login_events table (used for user login history)
  php artisan tinker --execute="echo Schema::hasTable('login_events') ? 'EXISTS' : 'MISSING';"

Report each result clearly. Do not proceed to any build phase until this diagnostic
is complete and reviewed.
```

---

# CC PHASE 0 — API
# Foundation: Auth, Guard, Audit Infrastructure, Overview

**Branch:** `git checkout -b cc/phase-0-api`
**Directory:** `cd wayfield/api && claude`
**Prerequisite:** Pre-flight diagnostic complete and reviewed.

---

## Phase 0 — API Prompt

```
You are building the Wayfield Command Center API foundation.
The Command Center is a completely separate system from the tenant web admin.

Read before writing:
@../docs/command_center/COMMAND_CENTER_OVERVIEW.md
@../docs/command_center/COMMAND_CENTER_SCHEMA.md
@../docs/02_domain/ROLE_MODEL.md

NON-NEGOTIABLE RULES:
  Route prefix: /api/platform/v1/    (never /api/v1/platform/)
  Auth guard: auth:platform_admin    (never auth:sanctum on platform routes)
  Identity table: admin_users        (platform_admins is deprecated — never reference it)
  Audit table: platform_audit_logs   (never audit_logs)
  Every mutation writes to platform_audit_logs — PlatformAuditService::record() — no exceptions.
  A tenant sanctum token on any platform route must return 403.
  A platform admin token on any tenant route must return 403.

For each task below: CHECK IF IT EXISTS FIRST before creating.
If a file or table already exists with equivalent functionality, SKIP that task and note it.
Never overwrite working code without first reading what is there.

═══════════════════════════════════════════════════════════
TASK 1 — VERIFY OR CREATE: admin_users TABLE
═══════════════════════════════════════════════════════════

Run:
  php artisan tinker --execute="echo Schema::hasTable('admin_users') ? 'EXISTS' : 'MISSING';"

If EXISTS: run the following and confirm the columns match expectations:
  php artisan tinker --execute="print_r(Schema::getColumnListing('admin_users'));"
  Expected columns: id, first_name, last_name, email, password, role, is_active,
                    email_verified_at, last_login_at, created_at, updated_at

If MISSING: create migration create_admin_users_table:
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
  Run: php artisan migrate

Commit: feat(cc-phase0-api-task1): verify or create admin_users table

═══════════════════════════════════════════════════════════
TASK 2 — VERIFY OR CREATE: AdminUser MODEL
═══════════════════════════════════════════════════════════

Check: cat app/Models/AdminUser.php

If it exists and has HasApiTokens, $table = 'admin_users', and role CONST: SKIP.

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

    protected $fillable = [
        'first_name', 'last_name', 'email', 'password', 'role', 'is_active',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'is_active'         => 'boolean',
        'email_verified_at' => 'datetime',
        'last_login_at'     => 'datetime',
    ];

    public const ROLES = ['super_admin','admin','support','billing','readonly'];
    public const MUTATING_ROLES = ['super_admin','admin','billing'];

    public function canMutate(): bool
    {
        return in_array($this->role, self::MUTATING_ROLES, true);
    }

    public function fullName(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }
}

Commit: feat(cc-phase0-api-task2): verify or create AdminUser model

═══════════════════════════════════════════════════════════
TASK 3 — VERIFY OR CREATE: PLATFORM GUARD IN config/auth.php
═══════════════════════════════════════════════════════════

Check: php artisan tinker --execute="echo array_key_exists('platform_admin', config('auth.guards')) ? 'EXISTS' : 'MISSING';"

If EXISTS: verify provider points to admin_users / AdminUser — if correct, SKIP.

If MISSING: open config/auth.php and add:

  Under 'guards':
    'platform_admin' => [
        'driver'   => 'sanctum',
        'provider' => 'admin_users',
    ],

  Under 'providers':
    'admin_users' => [
        'driver' => 'eloquent',
        'model'  => App\Models\AdminUser::class,
    ],

Verify: php artisan tinker --execute="echo config('auth.guards.platform_admin.provider');"
Expected output: admin_users

Commit: feat(cc-phase0-api-task3): verify or create platform_admin guard

═══════════════════════════════════════════════════════════
TASK 4 — VERIFY OR CREATE: EnsurePlatformToken MIDDLEWARE
═══════════════════════════════════════════════════════════

Check: cat app/Http/Middleware/EnsurePlatformToken.php

If it exists and checks instanceof AdminUser and is_active: SKIP.

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
                'error'   => 'platform_auth_required',
                'message' => 'This endpoint requires a platform admin token.',
            ], 403);
        }

        if (!$user->is_active) {
            return response()->json([
                'error'   => 'account_inactive',
                'message' => 'This admin account has been deactivated.',
            ], 403);
        }

        return $next($request);
    }
}

Register in bootstrap/app.php (Laravel 11) or app/Http/Kernel.php (Laravel 10):
  Laravel 11: ->withMiddleware(function (Middleware $middleware) {
                  $middleware->alias(['platform.auth' => EnsurePlatformToken::class]);
              })
  Laravel 10: $routeMiddleware['platform.auth'] = EnsurePlatformToken::class;

Commit: feat(cc-phase0-api-task4): verify or create EnsurePlatformToken middleware

═══════════════════════════════════════════════════════════
TASK 5 — CREATE: routes/platform.php
═══════════════════════════════════════════════════════════

Check: ls routes/platform.php

If it exists with platform/v1 prefix routes: SKIP.

If missing, create routes/platform.php:

<?php
declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Platform\PlatformAuthController;
use App\Http\Controllers\Api\Platform\OverviewController;

// Public platform routes (no auth required)
Route::prefix('platform/v1')->group(function () {

    // Auth — no platform_admin guard on login
    Route::post('/auth/login', [PlatformAuthController::class, 'login']);

    // All other platform routes require platform_admin auth
    Route::middleware(['auth:platform_admin', 'platform.auth'])->group(function () {

        Route::post('/auth/logout', [PlatformAuthController::class, 'logout']);
        Route::get('/me', [PlatformAuthController::class, 'me']);

        // Overview (Phase 0)
        Route::get('/overview', [OverviewController::class, 'index']);

        // Phases 1–3 routes will be added here as they are built.
        // Do not leave placeholder comments — add real routes only.
    });
});

Register in bootstrap/app.php (Laravel 11):
  ->withRouting(function (Router $router) {
      $router->middleware('api')
             ->prefix('api')
             ->group(base_path('routes/platform.php'));
  })

OR if bootstrap/app.php already has api routes registered via RouteServiceProvider,
add to boot() method:
  Route::middleware('api')
       ->prefix('api')
       ->group(base_path('routes/platform.php'));

Verify the route is registered:
  php artisan route:list | grep platform

Commit: feat(cc-phase0-api-task5): create platform routes file

═══════════════════════════════════════════════════════════
TASK 6 — CREATE: platform_audit_logs TABLE
═══════════════════════════════════════════════════════════

Check: php artisan tinker --execute="echo Schema::hasTable('platform_audit_logs') ? 'EXISTS' : 'MISSING';"

If EXISTS: verify columns — if adequate, SKIP.

If MISSING: create migration create_platform_audit_logs_table:

  Schema::create('platform_audit_logs', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('admin_user_id')->nullable();
    // Not a FK — allows log to survive admin deletion
    $table->unsignedBigInteger('organization_id')->nullable();
    $table->string('action', 100);              // e.g. 'plan_change', 'feature_flag_override'
    $table->string('entity_type', 100)->nullable(); // e.g. 'organization', 'automation_rule'
    $table->unsignedBigInteger('entity_id')->nullable();
    $table->json('old_value_json')->nullable();
    $table->json('new_value_json')->nullable();
    $table->json('metadata_json')->nullable();
    $table->dateTime('created_at');             // No updated_at — logs are immutable

    $table->index('admin_user_id');
    $table->index('organization_id');
    $table->index('action');
    $table->index('created_at');
  });
  Run: php artisan migrate

Note: NO updated_at column. Audit log entries are immutable — never update or delete.

Commit: feat(cc-phase0-api-task6): create platform_audit_logs table

═══════════════════════════════════════════════════════════
TASK 7 — CREATE: PlatformAuditService
═══════════════════════════════════════════════════════════

Check: cat app/Services/Platform/PlatformAuditService.php

If it exists with a record() method writing to platform_audit_logs: SKIP.

If missing, create app/Services/Platform/PlatformAuditService.php:

<?php
declare(strict_types=1);

namespace App\Services\Platform;

use App\Models\AdminUser;
use Illuminate\Support\Facades\DB;

/**
 * Immutable audit trail for all platform admin mutations.
 *
 * Every mutation of tenant data by a platform admin must call PlatformAuditService::record().
 * Writes to platform_audit_logs. Never updates or deletes audit entries.
 */
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
            'admin_user_id'  => $adminUser->id,
            'organization_id' => $organizationId,
            'action'         => $action,
            'entity_type'    => $entityType,
            'entity_id'      => $entityId,
            'old_value_json' => $oldValue !== null ? json_encode($oldValue) : null,
            'new_value_json' => $newValue !== null ? json_encode($newValue) : null,
            'metadata_json'  => !empty($metadata) ? json_encode($metadata) : null,
            'created_at'     => now(),
        ]);
    }
}

Commit: feat(cc-phase0-api-task7): create PlatformAuditService

═══════════════════════════════════════════════════════════
TASK 8 — CREATE: system_announcements TABLE
═══════════════════════════════════════════════════════════

Check: php artisan tinker --execute="echo Schema::hasTable('system_announcements') ? 'EXISTS' : 'MISSING';"

If EXISTS: SKIP.

If MISSING: create migration create_system_announcements_table:

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
  Run: php artisan migrate

Commit: feat(cc-phase0-api-task8): create system_announcements table

═══════════════════════════════════════════════════════════
TASK 9 — CREATE: PlatformAuthController
═══════════════════════════════════════════════════════════

Create app/Http/Controllers/Api/Platform/PlatformAuthController.php:

<?php
declare(strict_types=1);

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class PlatformAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $admin = AdminUser::where('email', $data['email'])
                          ->where('is_active', true)
                          ->first();

        if (!$admin || !Hash::check($data['password'], $admin->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        // Update last_login_at
        $admin->update(['last_login_at' => now()]);

        // Revoke existing tokens and create a fresh one
        $admin->tokens()->delete();
        $token = $admin->createToken('cc-platform-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'admin_user' => [
                'id'         => $admin->id,
                'first_name' => $admin->first_name,
                'last_name'  => $admin->last_name,
                'email'      => $admin->email,
                'role'       => $admin->role,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): JsonResponse
    {
        $admin = $request->user();
        return response()->json([
            'id'             => $admin->id,
            'first_name'     => $admin->first_name,
            'last_name'      => $admin->last_name,
            'email'          => $admin->email,
            'role'           => $admin->role,
            'last_login_at'  => $admin->last_login_at?->toIso8601String(),
        ]);
    }
}

Commit: feat(cc-phase0-api-task9): create PlatformAuthController

═══════════════════════════════════════════════════════════
TASK 10 — CREATE: OverviewController
═══════════════════════════════════════════════════════════

Create app/Http/Controllers/Api/Platform/OverviewController.php:

Returns a platform-wide snapshot. All queries cross all organisations.

<?php
declare(strict_types=1);

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class OverviewController extends Controller
{
    public function index(): JsonResponse
    {
        // Organizations
        $orgs = Organization::select('status')
            ->selectRaw('COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        // Users
        $totalUsers = User::count();
        $activeUsers = User::where('last_login_at', '>=', now()->subDays(30))->count();
        $newUsers7d = User::where('created_at', '>=', now()->subDays(7))->count();

        // Workshops
        $workshopTotal = Workshop::count();
        $workshopPublished = Workshop::where('status', 'published')->count();
        $workshopDraft = Workshop::where('status', 'draft')->count();

        // Subscriptions by plan (if subscriptions table exists)
        $planCounts = [];
        if (\Schema::hasTable('subscriptions')) {
            $planCounts = DB::table('subscriptions')
                ->where('status', 'active')
                ->select('plan_code', DB::raw('COUNT(*) as count'))
                ->groupBy('plan_code')
                ->pluck('count', 'plan_code')
                ->toArray();
        }

        // MRR (stub — accurate after Stripe webhook is wired)
        $mrrCents = null;
        if (\Schema::hasTable('stripe_subscriptions')) {
            // Placeholder — real MRR calculation after Stripe tables are populated
            $mrrCents = null;
        }

        // Recent platform audit events
        $recentAudit = DB::table('platform_audit_logs as pal')
            ->leftJoin('admin_users as au', 'pal.admin_user_id', '=', 'au.id')
            ->leftJoin('organizations as o', 'pal.organization_id', '=', 'o.id')
            ->select(
                'pal.action',
                'pal.created_at',
                DB::raw("CONCAT(COALESCE(au.first_name,''), ' ', COALESCE(au.last_name,'')) as admin_name"),
                'o.name as organization_name'
            )
            ->orderByDesc('pal.created_at')
            ->limit(10)
            ->get();

        return response()->json([
            'organizations' => [
                'total'     => Organization::count(),
                'active'    => $orgs->get('active', 0),
                'suspended' => $orgs->get('suspended', 0),
                'inactive'  => $orgs->get('inactive', 0),
                'by_plan'   => [
                    'free'       => $planCounts['free'] ?? 0,
                    'starter'    => $planCounts['starter'] ?? 0,
                    'pro'        => $planCounts['pro'] ?? 0,
                    'enterprise' => $planCounts['enterprise'] ?? 0,
                ],
            ],
            'users' => [
                'total'         => $totalUsers,
                'active_30_days' => $activeUsers,
                'new_7_days'    => $newUsers7d,
            ],
            'workshops' => [
                'total'     => $workshopTotal,
                'published' => $workshopPublished,
                'draft'     => $workshopDraft,
            ],
            'mrr_cents'           => $mrrCents,
            'recent_audit_events' => $recentAudit,
            'generated_at'        => now()->toIso8601String(),
        ]);
    }
}

Add route to routes/platform.php (inside authenticated group):
  Route::get('/overview', [OverviewController::class, 'index']);

Commit: feat(cc-phase0-api-task10): create overview endpoint

═══════════════════════════════════════════════════════════
TASK 11 — SEED: CREATE FIRST SUPER ADMIN
═══════════════════════════════════════════════════════════

Create database/seeders/PlatformAdminSeeder.php:

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
        // Only create if no super_admin exists
        if (AdminUser::where('role', 'super_admin')->exists()) {
            $this->command->info('Super admin already exists — skipping.');
            return;
        }

        AdminUser::create([
            'first_name' => 'Tomas',
            'last_name'  => 'Admin',
            'email'      => env('PLATFORM_ADMIN_EMAIL', 'admin@wayfieldapp.com'),
            'password'   => Hash::make(env('PLATFORM_ADMIN_PASSWORD', 'changeme-immediately')),
            'role'       => 'super_admin',
            'is_active'  => true,
        ]);

        $this->command->info('Super admin created. Change the password immediately.');
    }
}

Add PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD to .env and .env.example.
Run: php artisan db:seed --class=PlatformAdminSeeder

Commit: feat(cc-phase0-api-task11): add platform admin seeder

═══════════════════════════════════════════════════════════
TASK 12 — TESTS: PHASE 0 API
═══════════════════════════════════════════════════════════

Create tests/Feature/Platform/PlatformAuthTest.php:

Tests:
  - POST /api/platform/v1/auth/login with valid credentials → 200 + token + admin_user shape
  - POST /api/platform/v1/auth/login with invalid password → 422
  - POST /api/platform/v1/auth/login with inactive admin → 422
  - POST /api/platform/v1/auth/login with a TENANT user email → 422 (not in admin_users)
  - GET /api/platform/v1/me with valid platform token → 200 + correct admin shape
  - GET /api/platform/v1/me with tenant sanctum token → 403
  - GET /api/platform/v1/me with no token → 401
  - POST /api/platform/v1/auth/logout → 200, token revoked (subsequent /me returns 401)

Create tests/Feature/Platform/OverviewTest.php:

Tests:
  - GET /api/platform/v1/overview with platform token → 200 + expected JSON shape
  - GET /api/platform/v1/overview with tenant token → 403
  - GET /api/platform/v1/overview with no token → 401
  - Response contains organizations, users, workshops, generated_at keys

Run: ./vendor/bin/pest tests/Feature/Platform/
All tests must be green before committing.

Commit: feat(cc-phase0-api-task12): phase 0 API tests
```

---

# CC PHASE 0 — FRONTEND
# Login Screen, Shell, Overview Dashboard

**Branch:** `git checkout -b cc/phase-0-frontend`
**Prerequisite:** CC Phase 0 API merged and tests passing.
**Verify API works:** `curl -X POST http://localhost:8000/api/platform/v1/auth/login -H "Content-Type: application/json" -d '{"email":"admin@wayfieldapp.com","password":"changeme-immediately"}'`

---

## Phase 0 — Frontend Prompt

```
You are building CC-Web Phase 0: the foundation, login screen, persistent shell,
and overview dashboard for the Wayfield Command Center frontend.

Work in: wayfield/command/

Read before writing:
@../docs/command_center/COMMAND_CENTER_OVERVIEW.md
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md

NON-NEGOTIABLE RULES:
  API base: NEXT_PUBLIC_PLATFORM_API_URL  (never NEXT_PUBLIC_API_URL)
  Token key: cc_platform_token             (never same key as web/ tenant token)
  No @tremor/react. No shadcn/ui. No Radix. Plain Tailwind + recharts + lucide-react.
  Dark sidebar (#111827). Light content area (#F9FAFB).
  Apple HIG: 44px min touch targets. Focus rings. Loading/empty/error states on all screens.
  Fonts: Sora (headings), Plus Jakarta Sans (body), JetBrains Mono (data/metadata).

═══════════════════════════════════════════════════════════
PART 1 — FOUNDATION
═══════════════════════════════════════════════════════════

1A. FONTS (app/layout.tsx)
  Import Sora, Plus Jakarta Sans, JetBrains Mono from next/font/google.
  CSS variables: --font-heading (Sora), --font-sans (Plus Jakarta Sans), --font-mono (JetBrains Mono)
  Apply to <html> via className.

1B. TAILWIND CONFIG (tailwind.config.ts)
  fontFamily: {
    heading: ['var(--font-heading)', 'sans-serif'],
    sans:    ['var(--font-sans)', 'sans-serif'],
    mono:    ['var(--font-mono)', 'monospace'],
  }

1C. PLATFORM API CLIENT (lib/platform-api.ts)
  TOKEN_KEY = 'cc_platform_token'
  BASE_URL = process.env.NEXT_PUBLIC_PLATFORM_API_URL
  Export: platformApi.get/post/put/patch/delete
  Export: getPlatformToken, setPlatformToken, clearPlatformToken
  On 401: clearPlatformToken() + window.location.href = '/login'

1D. ADMIN USER CONTEXT (context/AdminUserContext.tsx)
  AdminRole type: 'super_admin'|'admin'|'support'|'billing'|'readonly'
  AdminUser interface: id, first_name, last_name, email, role
  AdminUserProvider: on mount fetch GET /me, set user or clear token
  useAdminUser() hook
  can object:
    manageBilling:      (role) => ['super_admin','billing'].includes(role)
    manageFeatureFlags: (role) => ['super_admin','admin'].includes(role)
    viewUsers:          (role) => ['super_admin','admin','support'].includes(role)
    viewFinancials:     (role) => ['super_admin','billing'].includes(role)
    viewSupport:        (role) => ['super_admin','admin','support'].includes(role)
    manageAutomations:  (role) => ['super_admin','admin'].includes(role)
    viewAuditLog:       (role) => ['super_admin','admin'].includes(role)
    manageSettings:     (role) => role === 'super_admin'

1E. ROOT LAYOUT (app/layout.tsx)
  Wrap with <AdminUserProvider>.
  Set lang="en" on <html>.

1F. ENVIRONMENT FILE
  Create .env.local.example:
    NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:8000/api/platform/v1
    NEXT_PUBLIC_SUPPORT_TOOL_URL=https://your-support-tool.com

Commit: feat(cc-web-phase0-part1): foundation — api client, context, fonts

═══════════════════════════════════════════════════════════
PART 2 — LOGIN SCREEN
═══════════════════════════════════════════════════════════

Route: /login  (public — no sidebar, no top bar)
API: POST /api/platform/v1/auth/login
Request: { email, password }
Response: { token, admin_user: { id, first_name, last_name, email, role } }

LAYOUT:
  Full viewport, dark bg (#111827).
  Centered card: bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-auto px-8 py-10.

ABOVE CARD:
  "WAYFIELD" in Sora 18px font-bold white, mb-1
  "Command Center" in JetBrains Mono 11px uppercase tracking-widest text-gray-400, mb-8

CARD CONTENT:
  H1: "Sign in" — Sora 24px font-semibold gray-900, mb-1
  Subtitle: "Platform administrator access only" — Plus Jakarta Sans 14px gray-500, mb-6

  Email input:
    Label: "Email address" (Plus Jakarta Sans 13px gray-700 mb-1)
    Input: type="email" autocomplete="email"
    Style: w-full h-[44px] border border-gray-200 rounded-lg px-4 text-sm
           focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent

  Password input: (same style, type="password", autocomplete="current-password", mt-4)

  Error area (mt-3, min-h-[20px]):
    If error: flex items-center gap-2
    AlertCircle icon (lucide, 14px red-500) + error text (text-sm text-red-600)
    Errors: "Invalid email or password." | "Connection error. Please check your network."

  Sign in button (mt-6):
    bg-[#0FA3B1] text-white w-full h-[44px] rounded-lg text-sm font-medium
    hover:bg-[#0d8f9c] focus-visible:ring-2 focus-visible:ring-[#0FA3B1]
    Loading state: show Loader2 icon (animate-spin, 16px) + "Signing in..." text, disabled

ON SUCCESS:
  setPlatformToken(token)
  setAdminUser(admin_user)
  router.replace('/')

ON 401/422: show inline error, do not redirect.
ON network error: show connection error, do not redirect.

If already authenticated (token in storage + /me succeeds): redirect('/') immediately.

Commit: feat(cc-web-phase0-part2): login screen

═══════════════════════════════════════════════════════════
PART 3 — PERSISTENT DARK SIDEBAR SHELL
═══════════════════════════════════════════════════════════

Files:
  app/(admin)/layout.tsx     — authenticated layout wrapper
  components/Sidebar.tsx     — dark sidebar navigation
  components/TopBar.tsx      — fixed top bar
  components/RoleBadge.tsx   — role badge (used in sidebar + topbar + settings)

AUTHENTICATED LAYOUT (app/(admin)/layout.tsx):
  On mount: if no adminUser after loading → redirect('/login').
  During loading: render dark bg only (prevents flash of content).
  Structure:
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TopBar />
      <div className="flex flex-1 pt-14">
        <Sidebar />
        <main className="flex-1 ml-56 overflow-y-auto">
          <div className="px-8 py-8">{children}</div>
        </main>
      </div>
    </div>

TOP BAR (components/TopBar.tsx):
  fixed, top-0, full width, h-14 (56px), z-30, bg-gray-900.
  Left (pl-4): logo mark (small teal square 10×10px) + gap-2 +
    "WAYFIELD" (Sora 14px font-bold white) + mx-3 separator (text-gray-600 "·") +
    "Command Center" (JetBrains Mono 11px text-gray-400 uppercase tracking-widest)
  Right (pr-4, flex items-center gap-3):
    admin.first_name + " " + admin.last_name (Plus Jakarta Sans 14px white)
    <RoleBadge role={adminUser.role} />
    Sign out button: "Sign out" (Plus Jakarta Sans 13px text-gray-400 hover:text-white
                    transition-colors, min-h-[44px] min-w-[44px] px-3)

SIGN OUT ACTION:
  platformApi.post('/auth/logout').catch(() => {})  // fire and forget
  clearPlatformToken()
  setAdminUser(null)
  router.replace('/login')

ROLE BADGE (components/RoleBadge.tsx):
  Props: role: AdminRole, size?: 'sm' | 'default'
  Pill: JetBrains Mono, uppercase, font-medium, rounded-full, border
  role → label mapping:
    super_admin → "SUPER ADMIN"
    admin       → "ADMIN"
    support     → "SUPPORT"
    billing     → "BILLING"
    readonly    → "READ ONLY"
  Colors (bg-opacity-15 background, colored text and border):
    super_admin: bg-[#E94F37]/15 text-[#E94F37] border-[#E94F37]/30
    admin:       bg-blue-500/15  text-blue-500  border-blue-500/30
    support:     bg-purple-500/15 text-purple-500 border-purple-500/30
    billing:     bg-[#E67E22]/15 text-[#E67E22] border-[#E67E22]/30
    readonly:    bg-gray-500/15  text-gray-400  border-gray-500/30
  size sm: text-[9px] px-1.5 py-0.5
  size default: text-[10px] px-2 py-0.5

SIDEBAR (components/Sidebar.tsx):
  fixed, left-0, top-0, h-full, w-56, z-20, bg-gray-900, overflow-hidden.
  Padding: px-3 pt-16 pb-6 (pt-16 clears the top bar).

  NAV ITEMS ARRAY:
    Built dynamically from adminUser.role using can helpers.
    Phase 0 items (all others added in later phases):

    Group 1 (always visible):
      { href: '/',             icon: LayoutDashboard, label: 'Overview' }
      { href: '/organizations', icon: Building2,       label: 'Organisations' }

    Role-filtered:
      if can.viewUsers:      { href: '/users',       icon: Users,         label: 'Users' }
      if can.viewFinancials:  { href: '/financials',  icon: CreditCard,    label: 'Financials' }
      if can.viewSupport:     { href: '/support',     icon: MessageCircle, label: 'Support' }

    Divider: <div className="my-3 border-t border-gray-800" />

    Group 2 (role-filtered):
      if can.manageAutomations: { href: '/automations', icon: Zap,          label: 'Automations' }
      security:                  { href: '/security',    icon: Shield,       label: 'Security' }
        (visible to super_admin, admin, support)
      if can.viewAuditLog:      { href: '/audit',        icon: ClipboardList,label: 'Audit Log' }
      if can.manageSettings:    { href: '/settings',     icon: Settings,     label: 'Settings' }

  NAV ITEM RENDERING:
    Use usePathname() to detect active route.
    Active: border-l-2 border-[#0FA3B1] bg-[#0FA3B1]/10 text-white ml-[-12px] pl-[14px]
    Inactive: text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors duration-150
    Item: h-10 flex items-center gap-3 rounded-lg text-sm px-3 cursor-pointer
    Icon: size={18}

  ROLE BADGE AT BOTTOM (mt-auto):
    <RoleBadge role={adminUser.role} />
    Admin full name below: Plus Jakarta Sans, 11px, text-gray-500, mt-1

Commit: feat(cc-web-phase0-part3): dark sidebar shell and top bar

═══════════════════════════════════════════════════════════
PART 4 — OVERVIEW DASHBOARD
═══════════════════════════════════════════════════════════

Route: /  (app/(admin)/page.tsx)
API: GET /api/platform/v1/overview

Expected response shape (from Phase 0 API):
  organizations: { total, active, suspended, by_plan: {free, starter, pro, enterprise} }
  users: { total, active_30_days, new_7_days }
  workshops: { total, published, draft }
  mrr_cents: int|null
  recent_audit_events: [{ admin_name, action, organization_name, created_at }]
  generated_at: ISO8601

PAGE HEADER:
  H1 "Overview" — font-heading text-2xl font-semibold text-gray-900
  Subtitle "Platform health at a glance" — font-sans text-sm text-gray-500 mt-1

ROW 1 — STAT CARDS (grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6):

  CARD COMPONENT (StatCard):
    Props: label, value, subtitle, alertLevel?: 'none'|'warning'|'error'
    Structure: bg-white rounded-xl border border-gray-200 shadow-sm p-6
    label: font-mono text-xs uppercase tracking-widest text-gray-400 mb-1
    value: font-heading text-3xl font-bold text-gray-900
    subtitle: font-sans text-sm text-gray-500 mt-1
    alertLevel warning: border-amber-300 bg-amber-50
    alertLevel error: border-red-300 bg-red-50

  Cards:
    1. label="ORGANISATIONS"  value={data.organizations.total}
       subtitle="{data.organizations.active} active"
    2. label="ACTIVE USERS"   value={data.users.active_30_days}
       subtitle="+{data.users.new_7_days} this week"
    3. label="WORKSHOPS"      value={data.workshops.published}
       subtitle="{data.workshops.draft} in draft"
    4. label="MRR"
       value={data.mrr_cents ? formatCurrency(data.mrr_cents / 100) : "—"}
       subtitle={data.mrr_cents ? "from active subscriptions" : "Stripe webhook not connected"}
       alertLevel={data.mrr_cents === null ? 'warning' : 'none'}

ROW 2 — TWO PANELS (grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4):

  LEFT PANEL: bg-white rounded-xl border border-gray-200 shadow-sm p-6
    H2 "Organisations by Plan" — font-heading text-base font-semibold text-gray-900 mb-4
    recharts PieChart (donut), height 220px:
      Data: [
        { name: 'Free', value: data.organizations.by_plan.free, color: '#9CA3AF' },
        { name: 'Starter', value: data.organizations.by_plan.starter, color: '#0FA3B1' },
        { name: 'Pro', value: data.organizations.by_plan.pro, color: '#E67E22' },
        { name: 'Enterprise', value: data.organizations.by_plan.enterprise, color: '#8B5CF6' },
      ]
      innerRadius={60} outerRadius={90}
      Custom legend below chart: colored dot (10px circle) + name + count
    If all plan counts are 0: "No organisations yet" in gray-400, centered, py-8

  RIGHT PANEL: bg-white rounded-xl border border-gray-200 shadow-sm p-6
    H2 "Recent Platform Activity" — font-heading text-base font-semibold gray-900 mb-4
    List of recent_audit_events (up to 10):
      Each row (py-3 border-b border-gray-50 last:border-0):
        Line 1: admin_name (font-sans text-sm text-gray-900) +
                action (font-mono text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded ml-2)
        Line 2: organization_name (font-sans text-xs text-gray-400) +
                relative timestamp (font-mono text-xs text-gray-400 ml-auto)
      Use a simple timeAgo() utility for relative timestamps.
    If empty: "No recent platform activity." — font-sans text-sm text-gray-400, py-8 text-center

LOADING STATE:
  isLoading = true: skeleton shimmer for all cards and panels.
  StatCard skeleton: animate-pulse bg-gray-200 rounded-xl h-28
  Panel skeleton: animate-pulse bg-gray-100 rounded-xl h-64

ERROR STATE:
  If fetch fails: red alert banner above row 1.
  bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3
  AlertTriangle icon (red-500, 16px) + "Failed to load overview data." +
  "Retry" button (text-sm text-red-600 font-medium underline, min-h-[44px])

MANUAL REFRESH:
  RefreshCw icon button top-right of page header area.
  min-h-[44px] min-w-[44px]. On click: re-fetch.
  While refreshing: icon animates (animate-spin).

Commit: feat(cc-web-phase0-part4): overview dashboard

═══════════════════════════════════════════════════════════
PART 5 — TESTS: PHASE 0 FRONTEND
═══════════════════════════════════════════════════════════

Write tests covering:

LOGIN:
  - Valid credentials: token stored, setAdminUser called, redirect to /
  - Invalid credentials (401): error message shown, no redirect, token not stored
  - Inactive admin (403): error message shown
  - Network failure: connection error message shown
  - If already has valid token + /me returns 200: redirect to / immediately

AUTH ISOLATION:
  - platformApi always uses NEXT_PUBLIC_PLATFORM_API_URL (never NEXT_PUBLIC_API_URL)
  - Token key in localStorage is 'cc_platform_token' (never conflicts with web/ key)
  - On 401 response: clearPlatformToken called, redirect to /login

ROUTE GUARD:
  - GET / without cc_platform_token: redirect to /login
  - GET / with valid token (/me returns 200): renders overview

SIDEBAR ROLE VISIBILITY:
  - super_admin: all 9 nav items present
  - admin: Settings not rendered
  - support: Financials, Automations, Audit Log not rendered
  - billing: Users, Support, Automations, Security, Audit Log, Settings not rendered
  - readonly: only Overview and Organisations rendered

LOGOUT:
  - Sign out: POST /auth/logout called, cc_platform_token removed, redirect /login

OVERVIEW:
  - Stat cards render with correct values
  - Loading skeletons shown while fetching
  - Error banner with retry shown on API failure
  - MRR card shows warning state when mrr_cents is null
  - Plan distribution chart renders with correct colors

Commit: feat(cc-web-phase0-part5): phase 0 frontend tests
```

---

# CC PHASE 1 — API
# Organisation Management, Feature Flags, Audit Log

**Branch:** `git checkout -b cc/phase-1-api`
**Prerequisite:** CC Phase 0 (API + frontend) complete and merged.

---

## Phase 1 — API Prompt

```
You are building the Wayfield Command Center Phase 1 API:
organisation management, feature flags, and audit log retrieval.

Read before writing:
@../docs/command_center/COMMAND_CENTER_SCHEMA.md
@../docs/02_domain/ROLE_MODEL.md

NON-NEGOTIABLE RULES:
  Route prefix: /api/platform/v1/
  Guard: auth:platform_admin + platform.auth middleware
  Every mutation writes to platform_audit_logs via PlatformAuditService::record()
  A tenant sanctum token on any platform route must return 403

═══════════════════════════════════════════════════════════
TASK 1 — VERIFY FEATURE FLAGS SCHEMA
═══════════════════════════════════════════════════════════

Check: php artisan tinker --execute="echo Schema::hasTable('feature_flags') ? 'EXISTS' : 'MISSING';"
Check: php artisan tinker --execute="echo Schema::hasTable('organization_feature_flags') ? 'EXISTS' : 'MISSING';"

If BOTH exist: SKIP to Task 2.

If MISSING, create migration create_feature_flags_tables:

  // Platform-wide feature flag definitions
  Schema::create('feature_flags', function (Blueprint $table) {
    $table->id();
    $table->string('feature_key', 100)->unique();
    $table->text('description')->nullable();
    $table->boolean('default_enabled')->default(false);
    $table->json('plan_defaults')->nullable(); // { "free": false, "starter": true, ... }
    $table->timestamps();
  });

  // Per-org overrides
  Schema::create('organization_feature_flags', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('organization_id');
    $table->foreign('organization_id')->references('id')->on('organizations')->onDelete('cascade');
    $table->string('feature_key', 100);
    $table->boolean('is_enabled');
    $table->string('source', 50)->default('manual_override'); // 'plan_default'|'manual_override'
    $table->unsignedBigInteger('set_by_admin_user_id')->nullable();
    $table->timestamps();
    $table->unique(['organization_id', 'feature_key']);
    $table->index('organization_id');
  });

  Run: php artisan migrate

  Seed initial feature flag definitions:
    DB::table('feature_flags')->insert([
      ['feature_key' => 'analytics',         'description' => 'Advanced analytics dashboard', 'default_enabled' => false, 'plan_defaults' => '{"free":false,"starter":false,"pro":true,"enterprise":true}', 'created_at' => now(), 'updated_at' => now()],
      ['feature_key' => 'api_access',         'description' => 'API and webhook access', 'default_enabled' => false, 'plan_defaults' => '{"free":false,"starter":false,"pro":true,"enterprise":true}', 'created_at' => now(), 'updated_at' => now()],
      ['feature_key' => 'leader_messaging',   'description' => 'Advanced leader messaging', 'default_enabled' => true, 'plan_defaults' => '{"free":false,"starter":true,"pro":true,"enterprise":true}', 'created_at' => now(), 'updated_at' => now()],
      ['feature_key' => 'waitlists',          'description' => 'Session waitlists', 'default_enabled' => false, 'plan_defaults' => '{"free":false,"starter":true,"pro":true,"enterprise":true}', 'created_at' => now(), 'updated_at' => now()],
      ['feature_key' => 'custom_branding',    'description' => 'Custom branding and logo', 'default_enabled' => false, 'plan_defaults' => '{"free":false,"starter":false,"pro":false,"enterprise":true}', 'created_at' => now(), 'updated_at' => now()],
    ]);

Commit: feat(cc-phase1-api-task1): verify or create feature flags schema

═══════════════════════════════════════════════════════════
TASK 2 — ORGANISATION ROUTES
═══════════════════════════════════════════════════════════

Create app/Http/Controllers/Api/Platform/OrganizationController.php:

Routes to add to routes/platform.php (inside authenticated group):
  Route::get('/organizations', [OrganizationController::class, 'index']);
  Route::get('/organizations/{id}', [OrganizationController::class, 'show']);
  Route::patch('/organizations/{id}/status', [OrganizationController::class, 'updateStatus']);
  Route::post('/organizations/{id}/billing/plan', [OrganizationController::class, 'changePlan']);
  Route::get('/organizations/{id}/feature-flags', [OrganizationController::class, 'featureFlags']);
  Route::post('/organizations/{id}/feature-flags', [OrganizationController::class, 'setFeatureFlag']);

INDEX method:
  Query params: search (name/email search), plan, status, page (25 per page)
  Join with subscriptions table for plan_code if it exists.
  Response per org:
    { id, name, slug, status, plan_code, contact_email, workshop_count,
      participant_count, manager_count, last_active_at, created_at }
  last_active_at: most recent updated_at of any workshop in this org (or org updated_at)

SHOW method:
  Full org details + subscription + usage counts.
  Response:
    { id, name, slug, status, contact_email, contact_phone, created_at, updated_at,
      subscription: { plan_code, status, current_period_start, current_period_end },
      usage: { workshop_count, workshop_limit, participant_count, participant_limit,
               manager_count, manager_limit } }
  Limits from plan: free(2/75/3), starter(10/250/10), pro(null), enterprise(null)
  workshop_count: count of org's workshops
  participant_count: count of registrations for org's workshops (registration_status='registered')
  manager_count: count of organization_users for this org

UPDATESTATUS method:
  Request: { status: 'active'|'suspended'|'inactive', reason: string (required) }
  Validates status is valid enum value.
  Updates organizations.status.
  Calls PlatformAuditService::record(
    adminUser: $request->user(),
    action: 'organization.status_changed',
    entityType: 'organization',
    entityId: $org->id,
    oldValue: ['status' => $old],
    newValue: ['status' => $data['status']],
    metadata: ['reason' => $data['reason']],
    organizationId: $org->id
  )
  Returns updated org.

CHANGEPLAN method:
  Request: { plan_code: 'free'|'starter'|'pro'|'enterprise', reason: string (required) }
  Role check: only super_admin and billing roles can call this. Others: 403.
  Check: $request->user()->canMutate() — if false, return 403.
  Additional role check: only billing|super_admin (not admin):
    if (!in_array($request->user()->role, ['super_admin','billing'])): return 403.
  Update subscriptions table: plan_code = new plan.
    If no subscription row exists: create one with status='active'.
  Calls PlatformAuditService with action='organization.plan_changed',
    oldValue=['plan_code'=>$old], newValue=['plan_code'=>$new],
    metadata=['reason'=>$reason], organizationId=$org->id
  Returns updated subscription.

FEATUREFLAGS method (GET):
  Returns all feature_flags joined with organization_feature_flags for this org.
  Response per flag:
    { feature_key, description, is_enabled, source: 'plan_default'|'manual_override' }
  is_enabled: if org override exists → use that. Else → use plan default from feature_flags.plan_defaults.

SETFEATUREFLAG method (POST):
  Request: { feature_key: string, is_enabled: boolean }
  Role check: only super_admin and admin. Others: 403.
  Upsert organization_feature_flags: { organization_id, feature_key, is_enabled,
    source: 'manual_override', set_by_admin_user_id: admin->id }
  Calls PlatformAuditService with action='feature_flag_override',
    oldValue=['is_enabled'=>$old], newValue=['is_enabled'=>$new],
    metadata=['feature_key'=>$key], organizationId=$org->id
  Returns updated flag row.

Commit: feat(cc-phase1-api-task2): organisation management routes

═══════════════════════════════════════════════════════════
TASK 3 — AUDIT LOG RETRIEVAL ROUTE
═══════════════════════════════════════════════════════════

Add to routes/platform.php:
  Route::get('/audit-logs', [AuditLogController::class, 'index']);

Create app/Http/Controllers/Api/Platform/AuditLogController.php:

INDEX method:
  Query params: admin_user_id, organization_id, action (partial match), date_from, date_to, page (50/page)
  Joins admin_users for admin name, organizations for org name.
  Orders by created_at DESC.
  Response per entry:
    { id, action, entity_type, entity_id, admin_user_id, admin_name,
      organization_id, organization_name, old_value_json, new_value_json,
      metadata_json, created_at }

Commit: feat(cc-phase1-api-task3): audit log retrieval route

═══════════════════════════════════════════════════════════
TASK 4 — TESTS: PHASE 1 API
═══════════════════════════════════════════════════════════

Create tests/Feature/Platform/OrganizationManagementTest.php:

  - GET /organizations → 200 + paginated list with correct shape
  - GET /organizations?search=xyz → filters by name
  - GET /organizations?plan=starter → filters by plan
  - GET /organizations/{id} → 200 + full detail
  - GET /organizations/{id} (not found) → 404
  - PATCH /organizations/{id}/status → updates status + writes audit log entry
  - PATCH /organizations/{id}/status without reason → 422
  - POST /organizations/{id}/billing/plan with super_admin → 200 + audit log
  - POST /organizations/{id}/billing/plan with admin role → 403
  - POST /organizations/{id}/billing/plan with support role → 403
  - POST /organizations/{id}/feature-flags with admin → 200 + audit log
  - POST /organizations/{id}/feature-flags with support → 403
  - All routes: 403 with tenant sanctum token

Create tests/Feature/Platform/AuditLogTest.php:
  - GET /audit-logs → 200 + paginated entries from platform_audit_logs
  - GET /audit-logs?organization_id=1 → filters correctly
  - GET /audit-logs?action=plan_changed → partial match filter works
  - 403 with tenant token

Run: ./vendor/bin/pest tests/Feature/Platform/
All green before committing.

Commit: feat(cc-phase1-api-task4): phase 1 API tests
```

---

# CC PHASE 1 — FRONTEND
# Organisation Management

**Branch:** `git checkout -b cc/phase-1-frontend`
**Prerequisite:** CC Phase 1 API merged and passing.
**Verify:** `curl -H "Authorization: Bearer {token}" http://localhost:8000/api/platform/v1/organizations`

---

## Phase 1 — Frontend Prompt

```
You are building CC-Web Phase 1: organisation management screens.

Read before writing:
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md

RULES: No @tremor/react. Tailwind + recharts + lucide-react only.
Dark sidebar, light content. 44px min touch targets. Full loading/empty/error states.

═══════════════════════════════════════════════════════════
PART 1 — SHARED COMPONENTS (needed across this phase)
═══════════════════════════════════════════════════════════

Create components/ui/StatCard.tsx
Create components/ui/StatusBadge.tsx  (active/inactive/suspended/past_due/trial)
Create components/ui/PlanBadge.tsx    (free/starter/pro/enterprise)
Create components/ui/UsageBar.tsx     (value, limit, shows green/amber/red thresholds)
Create components/ui/PageHeader.tsx   (h1, optional subtitle, optional right-side slot)
Create components/ui/Table.tsx        (thead/tbody wrappers with consistent styling)
Create components/ui/EmptyState.tsx   (icon, heading, subtitle, optional action)
Create components/ui/ErrorBanner.tsx  (red, AlertTriangle icon, message, retry callback)
Create components/ui/ConfirmModal.tsx (title, body, cancel + confirm buttons, destructive prop)
Create components/ui/Toast.tsx + useToast hook (success/error/info variants, 4s auto-dismiss)

All components: TypeScript strict, no any, exported with named exports.
Toast: fixed top-4 right-4 z-50, slide in from right 200ms, auto-dismiss 4000ms.

Commit: feat(cc-web-phase1-part1): shared UI components

═══════════════════════════════════════════════════════════
PART 2 — ORGANISATIONS LIST PAGE
═══════════════════════════════════════════════════════════

File: app/(admin)/organizations/page.tsx

PAGE HEADER: "Organisations" + "{total} total" subtitle.

FILTER BAR (flex row gap-3 mb-6):
  1. Search input (w-72): placeholder "Search by name or email"
     Prepend Search icon (lucide, 16px, gray-400). Debounce 300ms.
  2. Plan filter (multi-select dropdown):
     Options: All Plans | Free | Starter | Pro | Enterprise
     Checkboxes inside dropdown. Selected plans shown as count badge on trigger button.
  3. Status filter (single-select):
     Options: All Statuses | Active | Inactive | Suspended

All filters update URL search params and re-fetch.

TABLE: bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm
Columns: NAME | PLAN | STATUS | PARTICIPANTS | WORKSHOPS | LAST ACTIVE | VIEW

  NAME: font-sans text-sm font-medium text-gray-900, clickable link → /organizations/{id}
  PLAN: <PlanBadge plan={org.plan_code} />
  STATUS: <StatusBadge status={org.status} />
  PARTICIPANTS: font-mono text-sm text-gray-600
  WORKSHOPS: font-mono text-sm text-gray-600 (format: "{active}/{total}")
  LAST ACTIVE: font-sans text-sm text-gray-400 (relative: "3 days ago")
  VIEW: "View →" (text-sm text-[#0FA3B1] hover:text-[#0d8f9c] font-medium, min-h-[44px] block)

PAGINATION: below table. "Showing X–Y of Z" + Previous/Next buttons (min-h-[44px]).

LOADING: 8 skeleton rows (animate-pulse bg-gray-100 h-12 rounded my-1)
EMPTY: <EmptyState icon={Building2} heading="No organisations found" subtitle="Try adjusting your filters." />
ERROR: <ErrorBanner message="Failed to load organisations." onRetry={refetch} />

Commit: feat(cc-web-phase1-part2): organisations list page

═══════════════════════════════════════════════════════════
PART 3 — ORGANISATION DETAIL PAGE WITH TABS
═══════════════════════════════════════════════════════════

File: app/(admin)/organizations/[id]/page.tsx

Fetch: GET /api/platform/v1/organizations/{id}

PAGE HEADER:
  Left: org.name (H1) + <StatusBadge /> + <PlanBadge /> (ml-2 each)
  Right: "← Organisations" link (text-sm text-gray-500 hover:text-gray-700, min-h-[44px])

TAB BAR (border-b border-gray-200 mb-6):
  Tabs: Overview | Billing | Feature Flags | Usage | Audit
  Active: border-b-2 border-[#0FA3B1] text-[#0FA3B1] font-medium
  Inactive: text-gray-500 hover:text-gray-700 border-b-2 border-transparent transition-colors
  Height: 44px. Tab managed via ?tab= URL param.
  Role visibility:
    Feature Flags tab: hide for billing and support (do not render the tab element)
    Audit tab: hide for billing and readonly

OVERVIEW TAB (?tab=overview):
  grid grid-cols-2 gap-6
  Left: org details card + subscription card
  Right: 3 stat mini-cards (workshops, participants, managers)
  Ref: COMMAND_CENTER_PHASE_PROMPTS.md Part 3 for exact field layout

BILLING TAB (?tab=billing):
  Always show staleness notice:
    bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6
    AlertTriangle (amber-500 16px) + "Billing data is mirrored from Stripe and may not
    reflect real-time changes until the Stripe webhook handler is configured."
  Current subscription display.
  Plan Change button: only for super_admin and billing roles — check can.manageBilling(adminUser.role)
  Invoice list table: Date | Amount | Status | PDF Download link

PLAN CHANGE MODAL:
  Opens from "Change Plan" button.
  Radio buttons: Free | Starter | Pro | Enterprise (with PlanBadge on each)
  Reason textarea (required).
  Warning box if downgrading plan.
  Confirm: POST /api/platform/v1/organizations/{id}/billing/plan
  Cannot close by clicking backdrop (destructive action).
  Loading state on confirm button.
  On success: close modal, refresh org data, show success toast.
  On error: show error inside modal, do not close.

FEATURE FLAGS TAB (?tab=flags):
  Hidden for billing and support roles (do not render tab at all).
  Fetches: GET /api/platform/v1/organizations/{id}/feature-flags
  Table: FEATURE | DESCRIPTION | SOURCE | ENABLED | OVERRIDE
  SOURCE badge: "plan default" (gray) | "manual override" (teal)
  OVERRIDE toggle: only for super_admin and admin (can.manageFeatureFlags)
  Toggle POST: /api/platform/v1/organizations/{id}/feature-flags
  Optimistic UI + rollback on error.

USAGE TAB (?tab=usage):
  3 usage rows: Workshops | Participants | Managers
  Each: <UsageBar value={count} limit={limit} /> + "{count} of {limit}" label
  Unlimited plans: show "Unlimited" label, bar filled to 30% representative amount.

AUDIT TAB (?tab=audit):
  Hidden for billing and readonly.
  Fetches: GET /api/platform/v1/audit-logs?organization_id={id}
  Table: Date/Time | Admin | Action | Entity | Expand chevron
  Expandable row: pretty-printed JSON for old/new/metadata values.
  Note: "Platform admin actions only — not tenant audit events."

Commit: feat(cc-web-phase1-part3): organisation detail with tabs

═══════════════════════════════════════════════════════════
PART 4 — TESTS: PHASE 1 FRONTEND
═══════════════════════════════════════════════════════════

  - Organisations list renders, search debounces, plan filter works
  - Clicking org name navigates to /organizations/{id}
  - Feature Flags tab not rendered for billing and support roles
  - Audit tab not rendered for billing and readonly roles
  - Plan Change button not rendered for admin and support roles
  - Plan change modal cannot be closed by backdrop click
  - Feature flag toggle: optimistic update + rollback on error
  - Usage bar is red at 100%+, amber at 80–99%, teal below 80%
  - Staleness notice always visible on billing tab

Commit: feat(cc-web-phase1-part4): phase 1 frontend tests
```

---

# CC PHASE 2 — API
# Users, Financials, Login History

**Branch:** `git checkout -b cc/phase-2-api`
**Prerequisite:** CC Phase 1 complete and merged.

---

## Phase 2 — API Prompt

```
You are building the Wayfield Command Center Phase 2 API:
user management, financial data (Stripe mirror), login history.

Read before writing:
@../docs/command_center/COMMAND_CENTER_SCHEMA.md

RULES: All routes /api/platform/v1/. Guard: auth:platform_admin + platform.auth.
Tenant token → 403 on all routes.

═══════════════════════════════════════════════════════════
TASK 1 — VERIFY OR CREATE: login_events TABLE
═══════════════════════════════════════════════════════════

Check: php artisan tinker --execute="echo Schema::hasTable('login_events') ? 'EXISTS' : 'MISSING';"

If EXISTS: confirm columns include user_id, ip_address, outcome, created_at. If adequate: SKIP.

If MISSING: create migration create_login_events_table:
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
  Run: php artisan migrate

Commit: feat(cc-phase2-api-task1): verify or create login_events table

═══════════════════════════════════════════════════════════
TASK 2 — VERIFY OR CREATE: STRIPE MIRROR TABLES
═══════════════════════════════════════════════════════════

Run checks for each:
  php artisan tinker --execute="
    foreach (['stripe_customers','stripe_subscriptions','stripe_invoices','stripe_events'] as \$t)
      echo \$t.': '.(Schema::hasTable(\$t)?'EXISTS':'MISSING').PHP_EOL;"

For any MISSING, create migration create_stripe_mirror_tables:

  Schema::create('stripe_customers', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('organization_id')->unique();
    $table->foreign('organization_id')->references('id')->on('organizations')->onDelete('cascade');
    $table->string('stripe_customer_id', 100)->unique();
    $table->timestamps();
  });

  Schema::create('stripe_subscriptions', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('organization_id');
    $table->foreign('organization_id')->references('id')->on('organizations')->onDelete('cascade');
    $table->string('stripe_subscription_id', 100)->unique()->nullable();
    $table->string('plan_code', 50)->default('free');
    $table->enum('status', ['active','trialing','past_due','canceled','incomplete','unpaid'])->default('active');
    $table->dateTime('current_period_start')->nullable();
    $table->dateTime('current_period_end')->nullable();
    $table->dateTime('trial_ends_at')->nullable();
    $table->timestamps();
    $table->index('organization_id');
    $table->index('status');
    $table->index('plan_code');
  });

  Schema::create('stripe_invoices', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('organization_id');
    $table->foreign('organization_id')->references('id')->on('organizations')->onDelete('cascade');
    $table->string('stripe_invoice_id', 100)->unique();
    $table->unsignedInteger('amount_due')->default(0);     // cents
    $table->unsignedInteger('amount_paid')->default(0);    // cents
    $table->char('currency', 3)->default('usd');
    $table->enum('status', ['draft','open','paid','uncollectible','void'])->default('open');
    $table->string('invoice_pdf_url', 1000)->nullable();
    $table->dateTime('invoice_date');
    $table->timestamps();
    $table->index(['organization_id', 'status']);
  });

  Schema::create('stripe_events', function (Blueprint $table) {
    $table->id();
    $table->string('stripe_event_id', 100)->unique();
    $table->string('event_type', 100);
    $table->json('payload_json');
    $table->dateTime('processed_at')->nullable(); // null = received, not yet handled
    $table->dateTime('created_at');
    $table->index('event_type');
  });

  Run: php artisan migrate

Commit: feat(cc-phase2-api-task2): verify or create stripe mirror tables

═══════════════════════════════════════════════════════════
TASK 3 — USER MANAGEMENT ROUTES
═══════════════════════════════════════════════════════════

Add to routes/platform.php:
  Route::get('/users', [UserController::class, 'index']);
  Route::get('/users/{id}', [UserController::class, 'show']);

Create app/Http/Controllers/Api/Platform/UserController.php:

INDEX method:
  Query params: search (name or email), page (25/page)
  Response per user:
    { id, first_name, last_name, email, is_active, email_verified_at,
      last_login_at, created_at, organization_count }
  organization_count: count of organization_users rows for this user.

SHOW method:
  Response:
    { id, first_name, last_name, email, is_active, email_verified_at, last_login_at, created_at,
      organizations: [{ id, name, role, joined_at }],
      login_history: [{ ip_address, user_agent, outcome, created_at }] (last 10, desc)
    }
  organizations: join organization_users + organizations, get role and created_at.
  login_history: from login_events table. If table is empty: return [].

No mutation routes for users — platform admins read tenant users, not modify them.

Commit: feat(cc-phase2-api-task3): user management routes

═══════════════════════════════════════════════════════════
TASK 4 — FINANCIALS ROUTES
═══════════════════════════════════════════════════════════

Add to routes/platform.php:
  Route::get('/financials/overview', [FinancialsController::class, 'overview']);
  Route::get('/financials/invoices', [FinancialsController::class, 'invoices']);

Create app/Http/Controllers/Api/Platform/FinancialsController.php:

OVERVIEW method:
  Query stripe_subscriptions for active status counts.
  MRR: sum of plan monthly prices for active subscriptions (use static plan price map):
    free=0, starter=2900, pro=7900, enterprise=19900  (cents — adjust to actual pricing)
  If stripe_subscriptions table is empty: mrr_cents = null, arr_cents = null.

  Response:
    { mrr_cents: int|null, arr_cents: int|null,
      subscriptions: {
        active: int, trialing: int, past_due: int, canceled: int,
        by_plan: { free: int, starter: int, pro: int, enterprise: int }
      },
      stripe_webhook_connected: boolean  // true if stripe_events has any processed rows
    }
  stripe_webhook_connected = stripe_events table has rows with processed_at not null.

INVOICES method:
  Query params: status (paid|open|uncollectible|void|draft), page (25/page)
  Join with organizations for org name.
  Response per invoice:
    { id, stripe_invoice_id, organization_id, organization_name,
      amount_due, amount_paid, currency, status, invoice_pdf_url, invoice_date }
  Order by invoice_date DESC.

Commit: feat(cc-phase2-api-task4): financials routes

═══════════════════════════════════════════════════════════
TASK 5 — TESTS: PHASE 2 API
═══════════════════════════════════════════════════════════

Create tests/Feature/Platform/UserManagementTest.php:
  - GET /users → 200 + paginated list
  - GET /users?search=john → filters by name/email
  - GET /users/{id} → 200 + org memberships + login history
  - GET /users/{id} (not found) → 404
  - All routes: 403 with tenant token

Create tests/Feature/Platform/FinancialsTest.php:
  - GET /financials/overview → 200 with correct shape
  - mrr_cents is null when stripe_subscriptions table is empty
  - stripe_webhook_connected is false when no processed stripe_events
  - GET /financials/invoices → 200 + paginated
  - GET /financials/invoices?status=paid → filters correctly
  - All routes: 403 with tenant token

Commit: feat(cc-phase2-api-task5): phase 2 API tests
```

---

# CC PHASE 2 — FRONTEND
# Users, Financials, Support

**Branch:** `git checkout -b cc/phase-2-frontend`
**Prerequisite:** CC Phase 2 API merged and passing.

---

## Phase 2 — Frontend Prompt

```
You are building CC-Web Phase 2: Users, Financials, and Support screens.

Read before writing:
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md

RULES: No external component libraries. 44px touch targets. Full loading/empty/error states.

═══════════════════════════════════════════════════════════
PART 1 — USERS LIST AND SLIDE-OVER
═══════════════════════════════════════════════════════════

File: app/(admin)/users/page.tsx
Role guard: redirect to / if !can.viewUsers(adminUser.role)

LIST: search input + table (Name|Email|Orgs|Last Login|Verified|View)
Verified: CheckCircle (teal) or XCircle (gray-300) icon — never color alone (Apple HIG).
View: "View →" opens SlideOver, does NOT navigate.

USER DETAIL SLIDE-OVER (components/UserSlideOver.tsx):
  480px wide, right-side entry, 200ms ease-out.
  Backdrop: rgba(0,0,0,0.4) — clicking closes.
  Header: full name, email, verified badge, "Joined {date}".
  Section 1: Organisation memberships (org name link + role badge, or "No memberships").
  Section 2: Login history (last 10: date/time | IP | outcome badge).
    Outcome badges: success=teal, failed=amber, blocked=red.
  No edit or delete controls — read only.
  Loading: skeleton lines within the slide-over.

Commit: feat(cc-web-phase2-part1): users list and slide-over

═══════════════════════════════════════════════════════════
PART 2 — FINANCIALS
═══════════════════════════════════════════════════════════

File: app/(admin)/financials/page.tsx
Role guard: redirect to / if !can.viewFinancials(adminUser.role)

STALENESS NOTICE — always at top:
  bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6
  AlertTriangle (amber-500) + "Billing data is mirrored from Stripe and may not reflect
  real-time changes until the Stripe webhook handler is configured."

If stripe_webhook_connected = false: show additional bold note in amber:
  "Stripe webhook is not connected. Data below may be empty or stale."

ROW 1: 4 stat cards (MRR | ARR | Active Subscriptions | Trialing)
ROW 2: 2 panels (plan distribution bar chart | subscription status list)
INVOICE LIST: filterable by status, paginated table.

Ref: COMMAND_CENTER_PHASE_PROMPTS.md Part 2 for complete layout spec.

Commit: feat(cc-web-phase2-part2): financials page

═══════════════════════════════════════════════════════════
PART 3 — SUPPORT (EXTERNAL LINK)
═══════════════════════════════════════════════════════════

File: app/(admin)/support/page.tsx
Role guard: redirect to / if !can.viewSupport(adminUser.role)

Centered card with:
  MessageCircle icon (48px teal)
  "Support is managed externally"
  "Support tickets are handled in our external helpdesk. The in-database ticket schema
  exists and is reserved for a future direct integration."
  "Open Support Dashboard" button → opens NEXT_PUBLIC_SUPPORT_TOOL_URL in new tab.
  If env var not set: button disabled, show "NEXT_PUBLIC_SUPPORT_TOOL_URL not configured"
  Below button: font-mono text-xs gray-400 "Configure NEXT_PUBLIC_SUPPORT_TOOL_URL in .env"

Commit: feat(cc-web-phase2-part3): support page (external link)

═══════════════════════════════════════════════════════════
PART 4 — TESTS
═══════════════════════════════════════════════════════════

  - /users redirects billing and readonly to /
  - /financials redirects admin, support, readonly to /
  - User slide-over opens without navigating away
  - Slide-over backdrop click closes slide-over
  - Financials staleness notice always visible
  - Financials shows additional webhook warning when stripe_webhook_connected is false
  - Support page shows disabled button when env var not set

Commit: feat(cc-web-phase2-part4): phase 2 frontend tests
```

---

# CC PHASE 3 — API
# Automations, Security Events, Platform Config, Admin Management, Announcements

**Branch:** `git checkout -b cc/phase-3-api`
**Prerequisite:** CC Phase 2 complete and merged.

---

## Phase 3 — API Prompt

```
You are building the Wayfield Command Center Phase 3 API:
automations, security events, platform config, admin user management,
and system announcements.

Read before writing:
@../docs/command_center/COMMAND_CENTER_SCHEMA.md

RULES: All routes /api/platform/v1/. Guard: auth:platform_admin + platform.auth.
PlatformAuditService::record() on every mutation.

═══════════════════════════════════════════════════════════
TASK 1 — VERIFY OR CREATE: OPERATIONS TABLES
═══════════════════════════════════════════════════════════

Check all and create missing ones:

automation_rules:
  Schema::create('automation_rules', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('organization_id');
    $table->foreign('organization_id')->references('id')->on('organizations')->onDelete('cascade');
    $table->string('name', 255);
    $table->string('trigger_type', 100);
    $table->json('trigger_conditions_json')->nullable();
    $table->string('action_type', 100);
    $table->json('action_config_json')->nullable();
    $table->boolean('is_active')->default(true);
    $table->dateTime('last_run_at')->nullable();
    $table->timestamps();
    $table->index('organization_id');
    $table->index('is_active');
  });

automation_runs:
  Schema::create('automation_runs', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('automation_rule_id');
    $table->foreign('automation_rule_id')->references('id')->on('automation_rules')->onDelete('cascade');
    $table->dateTime('triggered_at');
    $table->dateTime('completed_at')->nullable();
    $table->enum('outcome', ['success','failed','skipped'])->default('success');
    $table->text('error_message')->nullable();
    $table->dateTime('created_at');
    $table->index('automation_rule_id');
  });

security_events:
  Schema::create('security_events', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('organization_id')->nullable();
    $table->unsignedBigInteger('user_id')->nullable();
    $table->string('event_type', 100);
    $table->enum('severity', ['low','medium','high','critical'])->default('low');
    $table->text('description')->nullable();
    $table->json('metadata_json')->nullable();
    $table->dateTime('created_at');
    $table->index(['severity', 'created_at']);
    $table->index('organization_id');
  });

platform_config:
  Schema::create('platform_config', function (Blueprint $table) {
    $table->id();
    $table->string('config_key', 100)->unique();
    $table->text('config_value')->nullable();
    $table->text('description')->nullable();
    $table->unsignedBigInteger('updated_by_admin_user_id')->nullable();
    $table->dateTime('updated_at');
  });

  // Seed default config keys (idempotent — only insert if missing):
  $defaults = [
    ['config_key' => 'support_tool_url',  'description' => 'External support tool URL'],
    ['config_key' => 'maintenance_mode',  'description' => 'Enable platform maintenance mode (true/false)'],
    ['config_key' => 'max_free_workshops','description' => 'Max workshops on free plan'],
    ['config_key' => 'max_free_participants','description' => 'Max participants on free plan'],
  ];
  foreach ($defaults as $d) {
    DB::table('platform_config')->insertOrIgnore(['config_key'=>$d['config_key'],'description'=>$d['description'],'updated_at'=>now()]);
  }

Run: php artisan migrate

Commit: feat(cc-phase3-api-task1): verify or create operations tables

═══════════════════════════════════════════════════════════
TASK 2 — AUTOMATION CRUD ROUTES
═══════════════════════════════════════════════════════════

Add to routes/platform.php:
  Route::get('/automations', [AutomationController::class, 'index']);
  Route::get('/automations/{id}', [AutomationController::class, 'show']);
  Route::post('/automations', [AutomationController::class, 'store']);
  Route::patch('/automations/{id}', [AutomationController::class, 'update']);
  Route::delete('/automations/{id}', [AutomationController::class, 'destroy']);

Create app/Http/Controllers/Api/Platform/AutomationController.php.

Role check on store/update/delete/status-toggle:
  Only super_admin and admin. Others: 403.

INDEX: filter by organization_id, trigger_type, is_active, page (25/page).
  Join organizations for org name. Join automation_runs for last_run_at.
  Response per rule: { id, organization_id, organization_name, name,
    trigger_type, action_type, is_active, last_run_at, created_at }

STORE: validate { organization_id, name, trigger_type, action_type, is_active?,
  trigger_conditions_json? (valid JSON string), action_config_json? (valid JSON string) }
  Audit: action='automation_rule.created'

UPDATE: same validation, partial update.
  Audit: action='automation_rule.updated', oldValue=current, newValue=changes

DESTROY: soft note in audit, then delete.
  Audit: action='automation_rule.deleted'

No "execute" endpoint — engine not implemented.

Commit: feat(cc-phase3-api-task2): automation CRUD routes

═══════════════════════════════════════════════════════════
TASK 3 — SECURITY EVENTS ROUTE
═══════════════════════════════════════════════════════════

Add: Route::get('/security/events', [SecurityController::class, 'index']);

Create app/Http/Controllers/Api/Platform/SecurityController.php:
  Filters: severity (multi), event_type, organization_id, date_from, date_to, page (50/page).
  Join organizations for org name. Join users for user email.
  Response per event: { id, event_type, severity, description, organization_id,
    organization_name, user_id, user_email, metadata_json, created_at }

Commit: feat(cc-phase3-api-task3): security events route

═══════════════════════════════════════════════════════════
TASK 4 — PLATFORM CONFIG ROUTES
═══════════════════════════════════════════════════════════

Add:
  Route::get('/config', [PlatformConfigController::class, 'index']);
  Route::put('/config/{key}', [PlatformConfigController::class, 'update']);

Create app/Http/Controllers/Api/Platform/PlatformConfigController.php:

INDEX: return all platform_config rows.
  Response: [{ config_key, config_value, description, updated_at }]

UPDATE: only super_admin. Others: 403.
  Validate { value: string|null }.
  Update config_value, updated_by_admin_user_id, updated_at.
  Audit: action='platform_config.updated', oldValue=['value'=>$old], newValue=['value'=>$new],
    metadata=['config_key'=>$key]

Commit: feat(cc-phase3-api-task4): platform config routes

═══════════════════════════════════════════════════════════
TASK 5 — ADMIN USER MANAGEMENT ROUTES
═══════════════════════════════════════════════════════════

Add:
  Route::get('/admins', [AdminUserController::class, 'index']);
  Route::post('/admins', [AdminUserController::class, 'store']);
  Route::patch('/admins/{id}/role', [AdminUserController::class, 'updateRole']);
  Route::patch('/admins/{id}/status', [AdminUserController::class, 'updateStatus']);

Create app/Http/Controllers/Api/Platform/AdminUserController.php:

ALL ROUTES: only super_admin. Others: 403. Check $request->user()->role === 'super_admin'.

LAST-SUPER-ADMIN GUARD (private helper):
  private function lastSuperAdmin(int $excludeId): bool {
    return AdminUser::where('role', 'super_admin')
                    ->where('is_active', true)
                    ->where('id', '!=', $excludeId)
                    ->doesntExist();
  }

INDEX: all admin_users, order by role then created_at.
  Response per admin: { id, first_name, last_name, email, role, is_active, last_login_at, created_at }

STORE: create new admin user.
  Validate: { first_name, last_name, email (unique in admin_users), password (min 12),
    password_confirmation, role (one of AdminUser::ROLES, NOT super_admin) }
  super_admin cannot be invited — only granted via updateRole.
  Hash password. Set is_active = true.
  Audit: action='admin_user.created'

UPDATEROLE: change role of an admin.
  Validate: { role: one of AdminUser::ROLES }
  Cannot modify own account: if $id === auth()->id(): 403.
  If new role removes super_admin AND lastSuperAdmin($id): 422 with message
    "Cannot demote the last active super_admin. Promote another admin to super_admin first."
  Update role.
  Audit: action='admin_user.role_changed', oldValue=['role'=>$old], newValue=['role'=>$new]

UPDATESTATUS: activate or deactivate admin.
  Validate: { is_active: boolean }
  Cannot deactivate self: if $id === auth()->id(): 403.
  If deactivating a super_admin AND lastSuperAdmin($id): 422 with message
    "Cannot deactivate the last active super_admin."
  Update is_active.
  Audit: action='admin_user.status_changed'

Commit: feat(cc-phase3-api-task5): admin user management routes

═══════════════════════════════════════════════════════════
TASK 6 — SYSTEM ANNOUNCEMENTS ROUTES
═══════════════════════════════════════════════════════════

Add:
  Route::get('/announcements', [AnnouncementController::class, 'index']);
  Route::post('/announcements', [AnnouncementController::class, 'store']);
  Route::patch('/announcements/{id}', [AnnouncementController::class, 'update']);
  Route::delete('/announcements/{id}', [AnnouncementController::class, 'destroy']);

These are read by the tenant web admin at GET /api/v1/system/announcements.
If that tenant route does not exist, create it (no auth required — public read):
  Route::get('/system/announcements', [SystemAnnouncementController::class, 'publicIndex']);
  Returns: only active announcements within starts_at/ends_at window.

Platform mutations (store/update/destroy): super_admin and admin only.
  Audit all mutations.

Commit: feat(cc-phase3-api-task6): system announcements routes

═══════════════════════════════════════════════════════════
TASK 7 — TESTS: PHASE 3 API
═══════════════════════════════════════════════════════════

AutomationTest.php:
  - CRUD happy paths + audit log entries
  - 403 for support/billing/readonly
  - No "execute" endpoint exists (404 for any /automations/{id}/run)
  - 403 for tenant token

AdminUserManagementTest.php:
  - Cannot create admin with super_admin role via store
  - Cannot update own role
  - Cannot deactivate own account
  - updateRole: last-super-admin guard returns 422 with correct message
  - updateStatus: last-super-admin guard returns 422 with correct message
  - All routes: 403 for non-super_admin platform admins
  - All routes: 403 for tenant token

PlatformConfigTest.php:
  - GET /config returns all keys
  - PUT /config/{key} by super_admin → updates value + audit log
  - PUT /config/{key} by admin → 403
  - 403 for tenant token

SecurityEventsTest.php:
  - GET /security/events → 200 + paginated
  - Severity filter works
  - 403 for tenant token

Commit: feat(cc-phase3-api-task7): phase 3 API tests
```

---

# CC PHASE 3 — FRONTEND
# Automations, Security, Audit Log, Settings

**Branch:** `git checkout -b cc/phase-3-frontend`
**Prerequisite:** CC Phase 3 API merged and passing.

---

## Phase 3 — Frontend Prompt

```
You are building CC-Web Phase 3: the final frontend phase.
Automations, Security Events, Audit Log, and Settings.

Read before writing:
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md

RULES: No external component libraries. 44px touch targets. Full loading/empty/error states.

═══════════════════════════════════════════════════════════
PART 1 — AUTOMATIONS
═══════════════════════════════════════════════════════════

File: app/(admin)/automations/page.tsx
Role guard: redirect to / if !can.manageAutomations(adminUser.role)

ENGINE NOTICE — always at top, not dismissible:
  bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6
  Zap icon (amber-500) + "Automation execution engine not implemented. Rules created
  here will not execute automatically until the engine is built."

FILTER BAR: org selector | trigger_type dropdown | status toggle (Active/Inactive/All)

TABLE: Organisation | Name | Trigger | Action | Status toggle | Last Run | Edit | Delete

STATUS TOGGLE: is_active toggle switch (super_admin, admin only — others see text badge).
  PATCH /api/platform/v1/automations/{id} { is_active: !current }

EDIT: opens rule editor slide-over (RuleEditorSlideOver component).
DELETE: opens ConfirmModal (destructive — coral red confirm button).

"+ New Rule" button: opens same RuleEditorSlideOver in create mode.

RULE EDITOR SLIDE-OVER (components/RuleEditorSlideOver.tsx):
  Fields: Organisation (searchable select) | Rule Name | Trigger Type (dropdown) |
    Trigger Conditions (JSON textarea, 6 rows, validate on blur) |
    Action Type (dropdown) | Action Config (JSON textarea) | Active toggle
  JSON validation: try JSON.parse() on blur, show inline error if invalid.
  Save: POST (create) or PATCH (edit). Loading state on button.
  On success: close slide-over, refresh list, success toast.
  No "Run Now" button anywhere.

Commit: feat(cc-web-phase3-part1): automations page

═══════════════════════════════════════════════════════════
PART 2 — SECURITY EVENTS
═══════════════════════════════════════════════════════════

File: app/(admin)/security/page.tsx
Visible to: super_admin, admin, support (redirect others to /)

FILTER BAR: severity multi-select | event_type text | date_from | date_to

SEVERITY BADGES (color + text, never color alone):
  low: gray, medium: blue, high: amber, critical: red

TABLE: Date/Time | Org | User | Event Type (font-mono badge) | Severity | Description
Expandable row: metadata_json pretty-printed.
Read-only. No actions.

Commit: feat(cc-web-phase3-part2): security events page

═══════════════════════════════════════════════════════════
PART 3 — AUDIT LOG
═══════════════════════════════════════════════════════════

File: app/(admin)/audit/page.tsx
Role guard: redirect to / if !can.viewAuditLog(adminUser.role)

Note at top: "Platform admin actions only — not tenant user events."

FILTER BAR: admin user dropdown | org search | action text | date_from | date_to

TABLE: Date/Time | Admin | Organisation | Action (teal badge) | Entity | Expand chevron
Expandable row: 3 sections — Previous Value | New Value | Metadata (each in code block)
JSON: JSON.stringify(value, null, 2) in monospace pre block, max-h-48 overflow-y-auto.

CSV EXPORT: "Export CSV" button top-right.
  GET /api/platform/v1/audit-logs/export with current filters.
  Triggers file download. Show loading state on button while downloading.
  (If export endpoint doesn't exist: show toast "Export not yet available.")

Commit: feat(cc-web-phase3-part3): audit log page

═══════════════════════════════════════════════════════════
PART 4 — SETTINGS
═══════════════════════════════════════════════════════════

File: app/(admin)/settings/page.tsx
Role guard: redirect to / if adminUser.role !== 'super_admin'

TWO SECTIONS:

SECTION 1 — PLATFORM CONFIGURATION:
  List of config key-value pairs.
  Each row: key (font-mono) + description (gray-500) + current value + Edit button.
  Edit: inline — replaces value text with input + Save/Cancel.
    Save: PUT /api/platform/v1/config/{key} { value: string }
    On success: update displayed value, success toast, return to read view.

SECTION 2 — ADMIN USER MANAGEMENT:
  Table: Name | Email | Role badge | Status badge | Last Login | Edit Role | Deactivate
  Deactivate: hidden for own account. Hidden if target is last super_admin (check count client-side as hint, but server enforces).
  Edit Role button: opens EditRoleModal.
  Deactivate: opens ConfirmModal (destructive).

  INVITE ADMIN button (top-right of section):
    Opens InviteAdminModal.
    Fields: First name | Last name | Email | Role (admin/support/billing/readonly — NOT super_admin)
    POST /api/platform/v1/admins
    On success: refresh list, success toast.

  EDIT ROLE MODAL:
    Shows current role badge.
    Role dropdown: super_admin | admin | support | billing | readonly.
    If target IS the last super_admin: disable super_admin option in dropdown with note
      "Cannot demote the last super_admin. Promote another admin first."
    PATCH /api/platform/v1/admins/{id}/role
    On 422 from API (last-super-admin guard): show error inside modal — not as toast.

  DEACTIVATE MODAL: standard ConfirmModal (destructive, coral red confirm).
    On 422 from API: show error inside modal.

Commit: feat(cc-web-phase3-part4): settings page

═══════════════════════════════════════════════════════════
PART 5 — TESTS: PHASE 3 FRONTEND
═══════════════════════════════════════════════════════════

  - Automations engine notice always visible, not dismissible
  - No "Run Now" button exists anywhere in automations
  - JSON textarea shows inline error for invalid JSON
  - Delete confirmation modal appears before DELETE
  - /security shows correct severity badge colors + text labels
  - Audit log expandable row shows all 3 JSON sections
  - /settings redirects admin/support/billing/readonly to /
  - Edit Role: super_admin option disabled when target is last super_admin
  - Edit Role 422 error: shown inside modal, modal stays open
  - Deactivate: own account row has no Deactivate button
  - Invite modal: super_admin not in role dropdown

Commit: feat(cc-web-phase3-part5): phase 3 frontend tests
```

---

## Post-Build Verification Checklist

```bash
# Run after all phases are complete and merged to main.

# API health
cd wayfield/api
./vendor/bin/pest tests/Feature/Platform/   # All green
php artisan route:list | grep platform      # 30+ routes registered

# Frontend build
cd wayfield/command
npm run build                               # Zero TypeScript errors
npm run test                                # All green

# Smoke tests (manual — with real browser)
# □ Super admin login works
# □ All 9 nav items visible for super_admin
# □ Overview dashboard loads with real data
# □ Organisation list loads, search works
# □ Plan change modal works + audit log entry appears
# □ Feature flag toggle works + audit log entry appears
# □ User search returns results
# □ Financials staleness notice always visible
# □ Automations engine notice always visible
# □ Audit log shows entries from platform_audit_logs (not audit_logs)
# □ /settings inaccessible as admin/support/billing/readonly
# □ Cannot deactivate own account
# □ Last-super-admin demotion rejected with correct modal error
# □ Sign out clears cc_platform_token, redirect to /login
# □ Tenant token returns 403 on any /api/platform/v1/ route
```
