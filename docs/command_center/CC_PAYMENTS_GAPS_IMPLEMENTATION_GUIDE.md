# Wayfield — Payments, Plan Rename & CC Gap Items
# Complete Implementation Guide with Claude Code Prompts
## docs/command_center/CC_PAYMENTS_GAPS_IMPLEMENTATION_GUIDE.md
## Version 1.0 — May 2026

---

## Overview

This guide is a **companion to CC_IMPLEMENTATION_GUIDE_COMPLETE.md**.
Run it in parallel — the DB rename (Phase DB) must be completed first and
merged before any CC phase from the main guide begins.

The payment control features (Phases PAY-0 and PAY-1) are already integrated
into CC Phase 2 of the main guide. If you are running this guide alongside the
main CC build, **skip PAY-0 and PAY-1** — they are covered there.

**Run order:**
```
1. Phase DB-RENAME  → merge → then begin CC Phase 0 from main guide
2. PAY-0 API        → already in CC Phase 2 API of main guide
3. PAY-1 Frontend   → already in CC Phase 2 Frontend of main guide
4. Phase GAP-1      → run after CC Phase 1 is merged
5. Phase GAP-2      → run after CC Phase 2 is merged
```

---

## Ground Rules (same as main guide)

```
API route prefix:   /api/platform/v1/
Auth guard:         auth:platform_admin + platform.auth
Audit table:        platform_audit_logs
Audit service:      PlatformAuditService::record()
Identity table:     admin_users
Plan DB codes:      foundation / creator / studio / enterprise  ← AFTER rename
Plan display names: Foundation / Creator / Studio / Enterprise
```

---

# PHASE DB-RENAME
# Permanently Rename Plan Codes Throughout the Entire Codebase

**This is the most consequential change in this guide.**
It renames the plan codes everywhere — database, config, services, tests.

**Why do this:** The `platform_take_rates` table already uses
`foundation/creator/studio/custom`. Every other part of the system
uses `free/starter/pro/enterprise`. This inconsistency is a permanent
source of confusion and bugs. Unifying them now, before the CC is built,
means the CC can use one consistent vocabulary throughout.

**Rename map:**
```
free       → foundation
starter    → creator
pro        → studio
enterprise → enterprise  (unchanged)
```

**Tables affected:**
- `subscriptions.plan_code` ENUM — primary change
- `feature_flags.plan_defaults` JSON keys — secondary change
- `organization_feature_flags.source` — NOT affected (uses 'plan_default'/'manual_override')

**Code affected:**
- `config/plans.php` — array keys
- `EnforceFeatureGateService` — hardcoded plan strings
- `PaymentFeatureFlagService` — hardcoded plan strings
- `DashboardMetricsService` — hardcoded plan strings
- Stripe webhook handler — plan_code mapping from Stripe Price IDs
- Any other service referencing plan code strings
- All tests referencing old plan codes

---

## Phase DB-RENAME — API

```bash
cd wayfield/api
git checkout main && git pull
git checkout -b feat/plan-code-rename
```

**Run in:** `cd wayfield/api && claude`

```
You are permanently renaming the Wayfield subscription plan codes throughout
the entire codebase. This is a breaking change. It must be done completely
in one branch — no partial renames.

RENAME MAP (commit this to memory for the entire session):
  OLD → NEW
  free       → foundation
  starter    → creator
  pro        → studio
  enterprise → enterprise (NO CHANGE)

Do not rename 'enterprise'. Do not change platform_take_rates.plan_code —
it already uses foundation/creator/studio/custom and is correct.

Read before writing:
@config/plans.php
@WAYFIELD_PAYMENT_SYSTEM_IMPLEMENTATION_GUIDE.md

═══════════════════════════════════════════════════════════
STEP 1 — AUDIT: FIND EVERY OCCURRENCE
═══════════════════════════════════════════════════════════

Run these searches and report all results before writing any code.
This step is read-only. Do not change anything yet.

1A. Database: check which tables store plan codes
  php artisan tinker --execute="
    \$tables = ['subscriptions','feature_flags','organization_feature_flags',
               'payment_feature_flags','carts','orders','stripe_subscriptions'];
    foreach (\$tables as \$t) {
      if (Schema::hasTable(\$t)) {
        echo \$t.': '.implode(', ', Schema::getColumnListing(\$t)).PHP_EOL;
      }
    }"

1B. Config files
  grep -rn "'free'\|'starter'\|'pro'\|'enterprise'" config/
  grep -rn "foundation\|creator\|studio" config/

1C. Application code (services, controllers, models)
  grep -rn "'free'\|'starter'\|'pro'\|\"free\"\|\"starter\"\|\"pro\"" \
    app/Services/ app/Http/Controllers/ app/Models/ \
    --include="*.php" | grep -v "vendor" | grep -v ".git"

1D. Tests
  grep -rn "'free'\|'starter'\|'pro'\|plan_code" tests/ --include="*.php" | head -50

1E. Database migration files (to understand current enum state)
  grep -rn "free.*starter.*pro\|plan_code" database/migrations/ | head -20

Report the full output. Do not proceed until all occurrences are listed.

═══════════════════════════════════════════════════════════
STEP 2 — DATABASE MIGRATION: RENAME PLAN CODES
═══════════════════════════════════════════════════════════

MySQL ENUM modification requires a three-step process to avoid data loss.
Create ONE migration file that does all three steps atomically.

Create: database/migrations/{timestamp}_rename_plan_codes_to_display_names.php

The migration must:

2A. Widen the ENUM to accept both old and new values:
  Schema::table('subscriptions', function (Blueprint $table) {
    $table->enum('plan_code',
      ['free','starter','pro','enterprise','foundation','creator','studio']
    )->default('foundation')->change();
  });

2B. Update all existing rows (translate old codes to new codes):
  DB::statement("UPDATE subscriptions SET plan_code = 'foundation' WHERE plan_code = 'free'");
  DB::statement("UPDATE subscriptions SET plan_code = 'creator' WHERE plan_code = 'starter'");
  DB::statement("UPDATE subscriptions SET plan_code = 'studio' WHERE plan_code = 'pro'");
  // enterprise stays as enterprise — no UPDATE needed

2C. Narrow the ENUM to only new values:
  Schema::table('subscriptions', function (Blueprint $table) {
    $table->enum('plan_code',
      ['foundation','creator','studio','enterprise']
    )->default('foundation')->change();
  });

2D. Update feature_flags.plan_defaults JSON keys (if table exists):
  if (Schema::hasTable('feature_flags') && Schema::hasColumn('feature_flags','plan_defaults')) {
    DB::statement("
      UPDATE feature_flags
      SET plan_defaults = JSON_OBJECT(
        'foundation', COALESCE(JSON_EXTRACT(plan_defaults, '$.free'), false),
        'creator',    COALESCE(JSON_EXTRACT(plan_defaults, '$.starter'), false),
        'studio',     COALESCE(JSON_EXTRACT(plan_defaults, '$.pro'), false),
        'enterprise', COALESCE(JSON_EXTRACT(plan_defaults, '$.enterprise'), false)
      )
      WHERE plan_defaults IS NOT NULL
        AND JSON_TYPE(plan_defaults) = 'OBJECT'
    ");
  }

2E. Update stripe_subscriptions.plan_code if that table exists and has a plan_code column:
  if (Schema::hasTable('stripe_subscriptions') &&
      Schema::hasColumn('stripe_subscriptions','plan_code')) {
    DB::statement("UPDATE stripe_subscriptions SET plan_code='foundation' WHERE plan_code='free'");
    DB::statement("UPDATE stripe_subscriptions SET plan_code='creator'    WHERE plan_code='starter'");
    DB::statement("UPDATE stripe_subscriptions SET plan_code='studio'     WHERE plan_code='pro'");
  }

The down() method reverses the rename:
  // Widen → revert data → narrow back to old values
  // Mirror of up() but in reverse direction

Run: php artisan migrate

Verify:
  php artisan tinker --execute="
    echo 'Distinct plan_codes in subscriptions: ';
    print_r(DB::table('subscriptions')->distinct()->pluck('plan_code')->toArray());"
  Expected: ['foundation'] or empty array if no subscription rows yet.
  Should NOT contain 'free', 'starter', or 'pro'.

git add . && git commit -m "feat(plan-rename): migrate plan codes to display-name values in database"

═══════════════════════════════════════════════════════════
STEP 3 — CONFIG: UPDATE config/plans.php
═══════════════════════════════════════════════════════════

Read the current file: cat config/plans.php

Update every array key from old to new:
  'free'       → 'foundation'
  'starter'    → 'creator'
  'pro'        → 'studio'
  'enterprise' → 'enterprise' (leave unchanged)

The 'display_names' sub-array changes from:
  'free' => 'Foundation', 'starter' => 'Creator', 'pro' => 'Studio', ...
To:
  'foundation' => 'Foundation', 'creator' => 'Creator', 'studio' => 'Studio', ...
  (The values stay the same — only the keys change)

The 'pricing' sub-array:
  'foundation' => [...], 'creator' => [...], 'studio' => [...], ...

The 'limits' sub-array:
  'foundation' => [...], 'creator' => [...], ...

The 'features' sub-array:
  'foundation' => [...], 'creator' => [...], ...

The 'order' array (if present):
  ['free','starter','pro','enterprise'] → ['foundation','creator','studio','enterprise']

AFTER updating, verify the file has zero occurrences of 'free', 'starter', or 'pro' as keys:
  grep -n "'free'\|'starter'\|'pro'" config/plans.php
  Expected: zero results (only display names like 'Foundation', 'Creator', 'Studio' as values are OK)

git add . && git commit -m "feat(plan-rename): update config/plans.php keys to new plan codes"

═══════════════════════════════════════════════════════════
STEP 4 — APPLICATION CODE: UPDATE ALL SERVICE FILES
═══════════════════════════════════════════════════════════

For each file found in Step 1C, update every hardcoded plan code string.

The pattern in every file is the same:
  'free'    → 'foundation'
  'starter' → 'creator'
  'pro'     → 'studio'
  'enterprise' stays as 'enterprise'

CRITICAL: 'free' also appears in other contexts:
  - payment_method = 'free' (orders table — a PAYMENT method, not a plan)
  - status = 'free' (if it exists anywhere)
  These must NOT be renamed. Only rename when the value represents a subscription plan tier.

HOW TO DISTINGUISH:
  - If the variable/column is named plan_code, plan, tier, subscription_plan: RENAME
  - If the variable/column is named payment_method, status, method: DO NOT RENAME

Common files to check and update:
  app/Services/EnforceFeatureGateService.php  (or similar name)
  app/Services/PaymentFeatureFlagService.php
  app/Services/DashboardMetricsService.php
  app/Services/SubscriptionService.php
  app/Http/Controllers/Api/Webhooks/StripeWebhookController.php
    (the handler that maps Stripe Price IDs to plan_code — this MUST use new codes)

For the Stripe webhook handler specifically:
  The mapping of STRIPE_PRICE_CREATOR_MONTHLY → 'creator' (was 'starter')
  The mapping of STRIPE_PRICE_STUDIO_MONTHLY  → 'studio' (was 'pro')
  Update these mappings to use the new plan codes.

After updating each file, verify no old plan codes remain as plan identifiers:
  grep -n "'free'\|'starter'\|'pro'" app/Services/ --include="*.php" -r
  (Review hits carefully — some may be payment_method='free' which is correct to keep)

git add . && git commit -m "feat(plan-rename): update service layer to new plan codes"

═══════════════════════════════════════════════════════════
STEP 5 — MODELS AND CONSTANTS
═══════════════════════════════════════════════════════════

Find any model that defines PLAN constants or casts:
  grep -rn "PLANS\|PLAN_CODES\|plan_code.*cast\|'free'\|'starter'\|'pro'" \
    app/Models/ --include="*.php"

Common locations:
  app/Models/Subscription.php — may have const PLANS = ['free','starter',...]
  app/Models/Organization.php — may have plan-related methods

Update all model constants and type hints.

If Subscription model has a PLANS const:
  const PLANS = ['foundation','creator','studio','enterprise'];

If Organization model has planIs() helper:
  // Old: $org->planIs('free')
  // New: $org->planIs('foundation')

git add . && git commit -m "feat(plan-rename): update model constants and plan definitions"

═══════════════════════════════════════════════════════════
STEP 6 — FACTORY FILES
═══════════════════════════════════════════════════════════

Update database factory files that generate plan codes:
  grep -rn "'free'\|'starter'\|'pro'" database/factories/ --include="*.php"

Common location: database/factories/SubscriptionFactory.php
  Change: 'plan_code' => fake()->randomElement(['free','starter','pro','enterprise'])
  To:     'plan_code' => fake()->randomElement(['foundation','creator','studio','enterprise'])

git add . && git commit -m "feat(plan-rename): update factory files to new plan codes"

═══════════════════════════════════════════════════════════
STEP 7 — TESTS: UPDATE ALL TEST FILES
═══════════════════════════════════════════════════════════

This is the largest update. Find every test file referencing old plan codes:
  grep -rn "'free'\|'starter'\|'pro'\|plan_code" tests/ --include="*.php"

For each file found, replace all plan code references:
  'free'    → 'foundation'
  'starter' → 'creator'
  'pro'     → 'studio'

Again: only rename values that represent subscription plan tiers.
Do NOT rename payment_method = 'free' in order tests.

After updating all test files, verify:
  grep -rn "plan_code.*free\|plan_code.*starter\|plan_code.*'pro'" tests/ --include="*.php"
  Expected: zero results

git add . && git commit -m "feat(plan-rename): update all tests to new plan codes"

═══════════════════════════════════════════════════════════
STEP 8 — RUN FULL TEST SUITE
═══════════════════════════════════════════════════════════

Run the complete test suite:
  ./vendor/bin/pest

ALL tests must be green. This rename touches core functionality — do not
proceed with any failures. Fix them before committing.

Common failure types to expect and fix:
  - Tests that assert plan_code = 'free' — update to 'foundation'
  - Tests that create subscriptions with old plan codes via factory — fixed in Step 6
  - Tests that check feature gate behaviour for 'starter' plan — update to 'creator'
  - API tests that POST plan_code='pro' — update to 'studio'

After all tests pass:
  git add . && git commit -m "feat(plan-rename): all tests green after plan code rename"

═══════════════════════════════════════════════════════════
STEP 9 — FINAL VERIFICATION
═══════════════════════════════════════════════════════════

9A. No old plan codes in PHP source (excluding vendor):
  grep -rn "'free'\|'starter'\|'pro'" \
    app/ config/ database/ routes/ tests/ \
    --include="*.php" \
    | grep -v "vendor" \
    | grep -v "payment_method.*free" \
    | grep -v "// "
  Review every result. Anything referencing plan tiers must use new codes.

9B. No old plan codes in database:
  php artisan tinker --execute="
    echo 'subscriptions: ';
    print_r(DB::table('subscriptions')->distinct()->pluck('plan_code')->toArray());
    if (Schema::hasTable('stripe_subscriptions')) {
      echo 'stripe_subscriptions: ';
      print_r(DB::table('stripe_subscriptions')->distinct()->pluck('plan_code')->toArray());
    }"
  Expected: only foundation/creator/studio/enterprise values.

9C. Feature flags JSON uses new keys:
  php artisan tinker --execute="
    if (Schema::hasTable('feature_flags')) {
      \$f = DB::table('feature_flags')->first();
      if (\$f) echo \$f->plan_defaults;
    }"
  Expected: JSON contains 'foundation','creator','studio','enterprise' keys.
  Must NOT contain 'free','starter','pro' keys.

9D. Config resolves correctly:
  php artisan tinker --execute="
    echo config('plans.display_names.foundation').PHP_EOL;
    echo config('plans.display_names.creator').PHP_EOL;
    echo config('plans.display_names.studio').PHP_EOL;
    echo config('plans.pricing.creator.monthly_cents').PHP_EOL;"
  Expected: Foundation, Creator, Studio, 4900

git add . && git commit -m "feat(plan-rename): verification complete — rename is clean"
```

**Merge Phase DB-RENAME:**
```bash
git push origin feat/plan-code-rename
# Open PR → code review (this is a high-impact change)
# Merge to main
git checkout main && git pull
```

**Post-merge: update documentation**
```bash
# Update DECISIONS.md — add this entry:
# DEC-RENAME-001: Plan DB codes permanently renamed.
#   free→foundation, starter→creator, pro→studio, enterprise unchanged.
#   Effective date: [merge date]. All new code must use new codes.
#   platform_take_rates was already correct and unchanged.

# Update DATA_SCHEMA_FULL.md:
# subscriptions.plan_code ENUM: change to ('foundation','creator','studio','enterprise')

# Update PRICING_AND_TIERS.md:
# Remove the "DB Code" column note — DB codes and display names are now the same.
```

---

# PHASE PAY-0
# Payment Controls API

> **Note:** If you are running CC_IMPLEMENTATION_GUIDE_COMPLETE.md, this phase
> is already included in CC Phase 2 API. Skip this phase and continue with
> the main guide. Only run this phase standalone if you are building payment
> controls independently of the CC build.

```bash
cd wayfield/api
git checkout main && git pull
git checkout -b cc/payments-api
```

**Run in:** `cd wayfield/api && claude`

```
You are adding payment control routes to the Wayfield Command Center API.
The plan code rename has been completed — all plan codes are now:
foundation / creator / studio / enterprise.
DO NOT use free, starter, or pro anywhere in this work.

Read before writing:
@WAYFIELD_PAYMENT_SYSTEM_IMPLEMENTATION_GUIDE.md
@../docs/command_center/COMMAND_CENTER_OVERVIEW.md
@config/plans.php

NON-NEGOTIABLE:
  Route prefix: /api/platform/v1/
  Guard: auth:platform_admin + platform.auth
  PlatformAuditService::record() on every mutation
  Roles for payment mutations: super_admin and billing only
  Take rate edits: super_admin ONLY (not billing)
  Tenant token → 403 on all routes

PLAN CODE CLARITY:
  subscriptions.plan_code: foundation/creator/studio/enterprise (after rename)
  platform_take_rates.plan_code: foundation/creator/studio/custom (unchanged)
  These two tables use the same foundation/creator/studio vocabulary now.
  'custom' in take_rates maps to Enterprise display name.

═══════════════════════════════════════════════════════════
TASK 1 — VERIFY payment_feature_flags TABLE
═══════════════════════════════════════════════════════════

Check: php artisan tinker --execute="echo Schema::hasTable('payment_feature_flags') ? 'EXISTS' : 'MISSING';"

If EXISTS with adequate schema: skip.

If MISSING, create migration create_payment_feature_flags_table:
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

  Seed the global kill switch (starts FALSE — nothing is on at launch):
  DB::table('payment_feature_flags')->insertOrIgnore([
    'scope' => 'platform', 'organization_id' => null,
    'flag_key' => 'payments_enabled', 'is_enabled' => false,
    'created_at' => now(), 'updated_at' => now()
  ]);

git add . && git commit -m "feat(cc-pay-task1): verify or create payment_feature_flags table"

═══════════════════════════════════════════════════════════
TASK 2 — VERIFY platform_take_rates TABLE
═══════════════════════════════════════════════════════════

Check: php artisan tinker --execute="echo Schema::hasTable('platform_take_rates') ? 'EXISTS' : 'MISSING';"

If EXISTS with all 4 rows seeded: skip.

If MISSING, create migration create_platform_take_rates_table:
  Schema::create('platform_take_rates', function (Blueprint $table) {
    $table->id();
    $table->enum('plan_code', ['foundation','creator','studio','custom'])->unique();
    $table->decimal('take_rate_pct', 5, 4);
    $table->boolean('is_active')->default(true);
    $table->text('notes')->nullable();
    $table->timestamps();
  });
  php artisan migrate

  Seed (idempotent):
  $rates = [
    ['plan_code'=>'foundation','take_rate_pct'=>0.0650],
    ['plan_code'=>'creator',   'take_rate_pct'=>0.0400],
    ['plan_code'=>'studio',    'take_rate_pct'=>0.0200],
    ['plan_code'=>'custom',    'take_rate_pct'=>0.0200],
  ];
  foreach ($rates as $r) {
    DB::table('platform_take_rates')->insertOrIgnore(
      $r + ['is_active'=>true,'created_at'=>now(),'updated_at'=>now()]
    );
  }

git add . && git commit -m "feat(cc-pay-task2): verify or create platform_take_rates table"

═══════════════════════════════════════════════════════════
TASK 3 — PaymentControlController: PLATFORM STATUS AND TOGGLES
═══════════════════════════════════════════════════════════

Create: app/Http/Controllers/Api/Platform/PaymentControlController.php

Add routes to routes/platform.php (inside auth group):
  Route::get('/payments/status', [PaymentControlController::class, 'status']);
  Route::post('/payments/enable', [PaymentControlController::class, 'enablePlatform']);
  Route::post('/payments/disable', [PaymentControlController::class, 'disablePlatform']);
  Route::get('/organizations/{id}/payments', [PaymentControlController::class, 'orgStatus']);
  Route::post('/organizations/{id}/payments/enable', [PaymentControlController::class, 'enableOrg']);
  Route::post('/organizations/{id}/payments/disable', [PaymentControlController::class, 'disableOrg']);
  Route::patch('/organizations/{id}/payments/flags/{flag_key}', [PaymentControlController::class, 'setOrgFlag']);

ROLE CHECKS:
  enablePlatform/disablePlatform/enableOrg/disableOrg/setOrgFlag:
    in_array($request->user()->role, ['super_admin','billing']) or return 403

STATUS endpoint (GET /payments/status):
  $platformFlag = DB::table('payment_feature_flags')
    ->where('scope','platform')->where('flag_key','payments_enabled')->first();
  $orgsEnabled = DB::table('payment_feature_flags')
    ->where('scope','organization')->where('flag_key','org_payments_enabled')
    ->where('is_enabled',true)->count();
  $stripeConnected = Schema::hasTable('stripe_connect_accounts')
    ? DB::table('stripe_connect_accounts')->count() : 0;
  $stripeCharges = Schema::hasTable('stripe_connect_accounts')
    ? DB::table('stripe_connect_accounts')->where('charges_enabled',true)->count() : 0;

  Response: {
    platform_payments_enabled: bool,
    enabled_at: ISO8601|null,
    orgs_payment_enabled_count: int,
    orgs_stripe_connected_count: int,
    orgs_stripe_charges_enabled_count: int,
    warning: string|null  // if orgs enabled but platform is OFF
  }

ENABLEPLATFORM (POST /payments/enable):
  DB::table('payment_feature_flags')->updateOrInsert(
    ['scope'=>'platform','flag_key'=>'payments_enabled'],
    ['is_enabled'=>true,'enabled_at'=>now(),'updated_at'=>now()]
  );
  PlatformAuditService::record($request->user(), 'platform_payments.enabled',
    metadata: ['previous_state'=>false]);
  return $this->status($request);

DISABLEPLATFORM (POST /payments/disable):
  DB::table('payment_feature_flags')->updateOrInsert(
    ['scope'=>'platform','flag_key'=>'payments_enabled'],
    ['is_enabled'=>false,'enabled_at'=>null,'updated_at'=>now()]
  );
  PlatformAuditService::record($request->user(), 'platform_payments.disabled');
  return $this->status($request);

ORGSTATUS (GET /organizations/{id}/payments):
  $org = Organization::findOrFail($id);
  $orgFlag = DB::table('payment_feature_flags')
    ->where('scope','organization')->where('organization_id',$id)
    ->where('flag_key','org_payments_enabled')->first();
  $connect = Schema::hasTable('stripe_connect_accounts')
    ? DB::table('stripe_connect_accounts')->where('organization_id',$id)->first() : null;
  $depositsFlag = DB::table('payment_feature_flags')
    ->where('scope','organization')->where('organization_id',$id)
    ->where('flag_key','deposits_enabled')->first();
  $waitlistFlag = DB::table('payment_feature_flags')
    ->where('scope','organization')->where('organization_id',$id)
    ->where('flag_key','waitlist_payments')->first();

  $platformEnabled = DB::table('payment_feature_flags')
    ->where('scope','platform')->where('flag_key','payments_enabled')
    ->where('is_enabled',true)->exists();

  Response: {
    organization_id, organization_name,
    org_payments_enabled: bool,
    stripe_connect: { connected, onboarding_status, charges_enabled,
      payouts_enabled, details_submitted, stripe_account_id,
      last_webhook_received_at, requirements },
    flags: { deposits_enabled, waitlist_payments },
    effective_payments_active: $platformEnabled && ($orgFlag->is_enabled??false)
      && ($connect->charges_enabled??false)
  }

ENABLEORG/DISABLEORG:
  DB::table('payment_feature_flags')->updateOrInsert(
    ['scope'=>'organization','organization_id'=>$id,'flag_key'=>'org_payments_enabled'],
    ['is_enabled'=>$enabled,'enabled_at'=>$enabled?now():null,'updated_at'=>now()]
  );
  PlatformAuditService::record($request->user(),
    $enabled ? 'org_payments.enabled' : 'org_payments.disabled',
    entityType:'organization', entityId:$id, organizationId:$id);

SETORGFLAG (PATCH /organizations/{id}/payments/flags/{flag_key}):
  Allowed flag_keys: deposits_enabled, waitlist_payments (reject others: 422)
  Request: { is_enabled: boolean }
  Upsert payment_feature_flags for this org/flag_key combination.
  PlatformAuditService::record(action:'org_payment_flag.updated',
    metadata:['flag_key'=>$flag_key,'is_enabled'=>$request->is_enabled])

git add . && git commit -m "feat(cc-pay-task3): platform and org payment control routes"

═══════════════════════════════════════════════════════════
TASK 4 — TAKE RATE MANAGEMENT ROUTES
═══════════════════════════════════════════════════════════

Add routes:
  Route::get('/payments/take-rates', [PaymentControlController::class, 'takeRates']);
  Route::patch('/payments/take-rates/{plan_code}', [PaymentControlController::class, 'updateTakeRate']);

TAKERATES (GET):
  Returns all platform_take_rates ordered by plan_code.
  Each row: {
    plan_code: 'foundation'|'creator'|'studio'|'custom',
    display_name: resolved from map (foundation→Foundation, creator→Creator,
                  studio→Studio, custom→Enterprise),
    take_rate_pct: formatted "6.50",
    take_rate_decimal: 0.0650,
    fee_on_100: formatted dollar amount on $100 sale,
    is_active: bool, notes: string|null, updated_at: ISO8601
  }

UPDATETAKERATE (PATCH /payments/take-rates/{plan_code}):
  Role: $request->user()->role === 'super_admin' or return 403
  Validate: plan_code in ['foundation','creator','studio','custom'] or 404
  Validate: take_rate_pct between 0.0000 and 0.2000 (0–20%) or 422
  Request: { take_rate_pct: decimal, notes?: string }
  $old = DB::table('platform_take_rates')->where('plan_code',$plan)->value('take_rate_pct');
  DB::table('platform_take_rates')->where('plan_code',$plan)->update([
    'take_rate_pct' => $request->take_rate_pct,
    'notes' => $request->notes,
    'updated_at' => now()
  ]);
  PlatformAuditService::record($request->user(), 'take_rate.updated',
    entityType:'platform_take_rate',
    oldValue:['take_rate_pct'=>$old,'plan_code'=>$plan],
    newValue:['take_rate_pct'=>$request->take_rate_pct,'plan_code'=>$plan],
    metadata:['notes'=>$request->notes]);
  Return updated row.

git add . && git commit -m "feat(cc-pay-task4): take rate management routes"

═══════════════════════════════════════════════════════════
TASK 5 — STRIPE CONNECT OVERSIGHT ROUTES
═══════════════════════════════════════════════════════════

Add routes:
  Route::get('/payments/connect-accounts', [PaymentControlController::class, 'connectAccounts']);
  Route::get('/payments/connect-accounts/{organization_id}', [PaymentControlController::class, 'connectAccountDetail']);

CONNECTACCOUNTS (GET):
  Paginated 25/page. Filters: onboarding_status, charges_enabled (bool).
  Join organizations for org name.
  Response per account: { organization_id, organization_name, stripe_account_id,
    onboarding_status, charges_enabled, payouts_enabled, details_submitted,
    country, last_webhook_received_at, has_pending_requirements }
  has_pending_requirements: requirements_json is not null and JSON_LENGTH > 0

CONNECTACCOUNTDETAIL (GET):
  Full detail including capabilities_json and requirements_json.
  Read only — no mutations.

Note: If stripe_connect_accounts table doesn't exist yet:
  return response()->json(['data'=>[],'stripe_connect_not_configured'=>true]);
  Never fail — always return a valid response.

git add . && git commit -m "feat(cc-pay-task5): Stripe Connect oversight routes"

═══════════════════════════════════════════════════════════
TASK 6 — TESTS
═══════════════════════════════════════════════════════════

Create tests/Feature/Platform/PaymentControlTest.php:

All plan codes in tests use NEW names: foundation/creator/studio/enterprise.

  - GET /payments/status → 200 with correct shape, platform_payments_enabled is bool
  - POST /payments/enable with super_admin → is_enabled=true in DB + audit log
  - POST /payments/enable with billing role → 200 (billing CAN enable payments)
  - POST /payments/enable with admin role → 403
  - POST /payments/enable with support role → 403
  - POST /payments/disable with super_admin → is_enabled=false + audit log
  - Tenant token on any /payments/* route → 403
  - GET /organizations/{id}/payments → 200 with correct shape
    including effective_payments_active computed correctly
  - POST /organizations/{id}/payments/enable → upserts flag + audit log
  - POST /organizations/{id}/payments/disable → same
  - PATCH /organizations/{id}/payments/flags/deposits_enabled → updates flag
  - PATCH /organizations/{id}/payments/flags/unknown_flag → 422
  - GET /payments/take-rates → 200 with 4 rows
    plan_codes are foundation/creator/studio/custom (NOT free/starter/pro)
  - PATCH /payments/take-rates/creator with super_admin → updated rate + audit log
  - PATCH /payments/take-rates/creator with value=0.25 → 422 (exceeds 20%)
  - PATCH /payments/take-rates/creator with billing role → 403
  - PATCH /payments/take-rates/free → 404 (old code doesn't exist)
  - GET /payments/connect-accounts → 200 (even if table is empty)
  - GET /payments/connect-accounts?onboarding_status=pending → filtered

./vendor/bin/pest tests/Feature/Platform/PaymentControlTest.php
All green before committing.

git add . && git commit -m "feat(cc-pay-task6): payment control API tests"
```

**Merge PAY-0 API:**
```bash
git push origin cc/payments-api
# Open PR → merge to main
git checkout main && git pull
```

---

# PHASE PAY-1
# Payment Controls Frontend

> **Note:** Already integrated into CC Phase 2 Frontend in the main guide.
> Only run standalone if building payments independently.

```bash
cd wayfield/command
git checkout main && git pull
git checkout -b cc/payments-frontend
```

**Run in:** `cd wayfield/command && claude`

```
You are building the payment controls section of the Wayfield Command Center.
Plan codes throughout this work: foundation / creator / studio / enterprise.
Never use free, starter, or pro. These no longer exist after the DB rename.

Read before writing:
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md
@../docs/command_center/CC_PAYMENTS_AND_GAP_ANALYSIS.md

NAVIGATION: Payment controls live as tabs within /financials.
  Tabs: Overview | Invoices | Payment Controls | Take Rates | Stripe Connect
  No new top-level nav items.

PLAN NAMES (always use display names in UI):
  foundation → Foundation (gray badge)
  creator    → Creator    (teal badge)
  studio     → Studio     (orange badge)
  enterprise → Enterprise (purple badge)
  custom     → Enterprise (purple badge) — for take_rates table only

ROLES:
  Payment platform toggle: super_admin and billing (can.managePayments)
  Per-org payment toggle: super_admin and billing
  Take rate edits: super_admin ONLY (can.manageTakeRates)
  All payment data: viewable by all roles

═══════════════════════════════════════════════════════════
PART 1 — PAYMENT CONTROLS TAB (/financials?tab=payment-controls)
═══════════════════════════════════════════════════════════

File: app/(admin)/financials/page.tsx (add tab to existing financials page)

This is the highest-stakes screen. Design it to convey that gravity.

PLATFORM PAYMENT SWITCH CARD:
  bg-white rounded-2xl border-2 shadow-md p-8
  Border: border-teal-400 when ON, border-amber-400 when OFF

  Left:
    Status label (font-mono text-xs uppercase tracking-widest):
      ON: "GLOBAL PAYMENTS — ACTIVE" text-teal-600
      OFF: "GLOBAL PAYMENTS — DISABLED" text-amber-600
    Large status badge
    Subtitle: "Controls payment surfaces across all {count} organisations"

  Right (can.managePayments only):
    OFF state: "Enable Platform Payments" button
      bg-[#0FA3B1] text-white px-6 min-h-[44px] rounded-lg
    ON state: "Disable Platform Payments" button
      bg-[#E94F37] text-white px-6 min-h-[44px] rounded-lg

ENABLE MODAL (ConfirmModal — cannot dismiss via backdrop):
  Title: "Enable Platform Payments"
  Body: "This will make payment surfaces visible to all organisations
         that have been individually enabled ({count} orgs ready).
         Participants will be able to pay for workshops immediately."
  Confirm: "Enable Payments" teal button min-h-[44px]

DISABLE MODAL (ConfirmModal with type-to-confirm):
  Title: "⚠ Disable Platform Payments"
  Body in amber callout:
    "This is a platform-wide action. ALL payment surfaces across ALL
     organisations will be hidden immediately. Participants in the
     middle of checkout will lose their cart.
     This affects {orgs_payment_enabled_count} organisations."
  Type-to-confirm input: user must type exactly "DISABLE"
    Confirm button disabled until input === "DISABLE" (case-sensitive)
  Confirm: "Disable All Payments" bg-[#E94F37] min-h-[44px]

WARNING BANNER (below switch, when platform ON):
  If orgs_stripe_connected_count < orgs_payment_enabled_count:
    amber banner: "X organisations are payment-enabled but Stripe Connect
    is not complete — they cannot process payments yet."

STATS ROW (grid grid-cols-3 gap-4 mt-6):
  "ORGS WITH PAYMENTS ON" | "STRIPE CONNECTED" | "CHARGES ENABLED"
  Each: bg-gray-50 rounded-xl border border-gray-200 p-4
  Label: font-mono text-xs uppercase tracking-widest text-gray-400
  Value: font-heading text-2xl font-bold text-gray-900

git add . && git commit -m "feat(cc-web-pay-part1): platform payment switch UI"

═══════════════════════════════════════════════════════════
PART 2 — PAYMENTS TAB IN ORGANISATION DETAIL
═══════════════════════════════════════════════════════════

Add "Payments" tab to app/(admin)/organizations/[id]/page.tsx.
Position: after Usage, before Audit. Visible to all roles.

EFFECTIVE STATUS BANNER (always first in tab):
  effective_payments_active=true → green: "Payments are ACTIVE for this organisation"
  platform disabled → amber: "Platform payments are globally disabled."
  org disabled → gray: "Payments are disabled for this organisation."
  Stripe incomplete → red: "Stripe Connect incomplete — payments cannot process."

PAYMENT TOGGLE CARD:
  org_payments_enabled badge + Enable/Disable button (can.managePayments only)
  No confirmation modal — per-org is lower stakes than global.
  POST /organizations/{id}/payments/enable or /disable
  Loading state on button. Update UI on success.

STRIPE CONNECT STATUS CARD:
  onboarding_status badge, charges_enabled, payouts_enabled, details_submitted
  (all with CheckCircle/XCircle + aria-label — Apple HIG: no color-only info)
  Last webhook: relative or "Never"
  Stripe Account ID: font-mono text-xs gray-400
  Pending requirements: amber list of strings from requirements_json
  "Stripe Connect accounts are managed in the Stripe Dashboard."
  "Open Stripe Dashboard →" external link (if stripe_account_id exists)

ADDITIONAL FLAGS CARD:
  deposits_enabled toggle row (label: "Deposit pricing enabled")
  waitlist_payments toggle row (label: "Waitlist payment charging")
  PATCH /organizations/{id}/payments/flags/{flag_key}
  can.managePayments only. Optimistic UI.

git add . && git commit -m "feat(cc-web-pay-part2): per-org payments tab in org detail"

═══════════════════════════════════════════════════════════
PART 3 — TAKE RATES TAB (/financials?tab=take-rates)
═══════════════════════════════════════════════════════════

INFO NOTICE (always visible):
  bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6
  text-sm text-blue-700: "Take rates are Wayfield's transaction fee on each
  participant payment. Deducted via Stripe Connect before funds transfer
  to organisers. Changes take effect on new transactions immediately."

TABLE (4 rows):
  Columns: PLAN CODE (font-mono) | DISPLAY NAME (PlanBadge) | TAKE RATE | FEE ON $100 | NOTES | EDIT

  Plan code display: foundation/creator/studio/custom (font-mono text-sm gray-900)
  Display name badge: Foundation=gray, Creator=teal, Studio=orange,
    custom→Enterprise=purple

  EDIT button: only for can.manageTakeRates (super_admin). Others: button absent.

EDIT MODAL:
  Title "Edit Take Rate — {display name}"
  Current rate (read-only reference)
  New rate input: type="number" step="0.01" min="0" max="20" with "%" label
  Live preview: "Fee on $100: ${calculated}" — updates as user types
  Notes textarea (optional)
  Warning callout: "Changes affect all future {display name} transactions.
    Past payments are unaffected."
  PATCH /payments/take-rates/{plan_code}
  On 403 (non-super_admin): show toast "Only super admins can edit take rates."
  On 422: show error inline in modal.

git add . && git commit -m "feat(cc-web-pay-part3): take rates tab"

═══════════════════════════════════════════════════════════
PART 4 — STRIPE CONNECT TAB (/financials?tab=stripe-connect)
═══════════════════════════════════════════════════════════

SUMMARY CARDS (grid-cols-4 gap-4 mb-6):
  Complete (teal) | Pending (amber) | Restricted (orange) | Deauthorized (red)
  Each shows count. Loading: skeleton cards.

FILTER BAR: onboarding_status multi-select | charges_enabled (All/Yes/No)

TABLE:
  Org (link → /organizations/{id}?tab=payments) | Status badge | Charges | Payouts |
  Submitted | Last Webhook | Reqs | "→" link

  Status badges:
    complete: teal | pending: amber | initiated: blue | restricted: orange | deauthorized: red
  Charges/Payouts/Submitted: CheckCircle (teal, aria-label="Yes") or XCircle (gray-300, aria-label="No")
  Last Webhook: font-mono text-xs gray-400 relative or "Never"
  Reqs: amber "Pending" badge if requirements exist, else "—"

  If table empty or stripe_connect_not_configured=true:
    <EmptyState icon={CreditCard}
      heading="No Stripe Connect accounts"
      subtitle="Stripe Connect accounts appear here when organisers complete onboarding." />

Read only. No mutations.
Note at bottom: "Manage Connect accounts in the Stripe Dashboard."

git add . && git commit -m "feat(cc-web-pay-part4): Stripe Connect oversight tab"

═══════════════════════════════════════════════════════════
PART 5 — TESTS
═══════════════════════════════════════════════════════════

All plan codes in tests use new names: foundation/creator/studio/enterprise.

  - Platform DISABLE modal: confirm button disabled until "DISABLE" typed exactly
  - Platform DISABLE modal: button activates at "DISABLE", not "disable"
  - Platform ENABLE modal: no type-to-confirm required, confirm fires immediately
  - canManagePayments: true for super_admin + billing, false for admin/support/readonly
  - canManageTakeRates: true for super_admin ONLY
  - Take rate Edit button absent for billing role (not disabled — absent)
  - Take rate live preview updates as user types rate value
  - Org Payments tab visible for all roles, mutations blocked for non-billing
  - Stripe Connect tab shows empty state when no accounts exist
  - Charges column uses both CheckCircle/XCircle AND aria-labels (color not alone)
  - Take rate table shows Foundation/Creator/Studio/Enterprise display names

git add . && git commit -m "feat(cc-web-pay-part5): payment frontend tests"
```

**Merge PAY-1 Frontend:**
```bash
git push origin cc/payments-frontend
# Open PR → merge to main
git checkout main && git pull
```

---

# PHASE GAP-1
# Priority 2 Gap Items: Workshop Pricing Audit, Refund Policies,
# Readiness Scores, Leader Profile Completion

**Prerequisite:** CC Phase 1 (org management) is merged and live.

```bash
cd wayfield/api
git checkout main && git pull
git checkout -b cc/gap-items-priority2
```

**Run in:** `cd wayfield/api && claude`

```
You are adding Priority 2 gap items to the Wayfield Command Center API.
These are read-only oversight views that give the platform admin visibility
into workshop pricing health, refund policy coverage, workshop readiness,
and leader profile completion across all organisations.

NON-NEGOTIABLE:
  Route prefix: /api/platform/v1/
  Guard: auth:platform_admin + platform.auth
  All routes in this phase are READ ONLY — no mutations.
  Tenant token → 403 on all routes.

═══════════════════════════════════════════════════════════
TASK 1 — WORKSHOP PRICING AUDIT ROUTE
═══════════════════════════════════════════════════════════

Add route: Route::get('/workshops/pricing-audit', [WorkshopAuditController::class, 'pricingAudit']);

Create: app/Http/Controllers/Api/Platform/WorkshopAuditController.php

pricingAudit():
  Query params: organization_id (filter), has_pricing (bool), page (25/page)

  For each workshop, collect from workshop_pricing and session_pricing tables
  (guard with Schema::hasTable before querying — these tables may not exist yet):
    base_price_cents, currency, is_paid, deposit_enabled, deposit_amount_cents

  From workshop_price_tiers (if table exists):
    Count of active tiers (tiers where valid_from <= now() and valid_until >= now()
    or valid_until is null)

  Response per workshop:
  {
    workshop_id, title, organization_id, organization_name, status,
    pricing: {
      has_pricing: bool,
      base_price_cents: int|null,
      currency: string|null,
      deposit_enabled: bool,
      deposit_amount_cents: int|null,
      active_tier_count: int,
      session_pricing_count: int  // count of add-on sessions with pricing
    }
  }

  Filters:
    has_pricing=true: only workshops with base_price_cents > 0 or session_pricing
    has_pricing=false: only workshops with no pricing configured

git add . && git commit -m "feat(cc-gap1-task1): workshop pricing audit route"

═══════════════════════════════════════════════════════════
TASK 2 — REFUND POLICY AUDIT ROUTE
═══════════════════════════════════════════════════════════

Add route: Route::get('/financials/refund-policies', [FinancialsController::class, 'refundPolicies']);

refundPolicies():
  (Only if refund_policies table exists — guard with Schema::hasTable)
  Query params: organization_id, policy_level (platform|org|workshop), page 25/page

  Return paginated refund_policies:
  {
    id, policy_level, organization_id, organization_name, workshop_id, workshop_title,
    policy_type, custom_policy_text, is_active, created_at
  }

  Include summary counts at top of response:
  {
    summary: {
      total: int,
      platform_level: int,
      org_level: int,
      workshop_level: int,
      workshops_without_policy: int  // count of paid workshops with no refund policy
    },
    data: [...paginated policies]
  }

  workshops_without_policy: count of workshops where is_paid=true
    AND no refund_policy exists for that workshop_id AND no org-level policy exists
    (This identifies potential compliance gaps)

  If refund_policies table doesn't exist:
    return { summary: { unavailable: true, reason: 'refund_policies table not yet created' }, data: [] }

git add . && git commit -m "feat(cc-gap1-task2): refund policy audit route"

═══════════════════════════════════════════════════════════
TASK 3 — WORKSHOP READINESS SCORES ROUTE
═══════════════════════════════════════════════════════════

Add route: Route::get('/workshops/readiness', [WorkshopAuditController::class, 'readiness']);

readiness():
  Query params: organization_id, min_score (int 0-100), max_score (int 0-100),
    status (draft|published), page 25/page

  For each workshop, compute a readiness score 0–100.
  Score components (each is pass=1/fail=0, weighted equally):
    1. title exists and is not blank (10 pts)
    2. description exists and length > 50 chars (10 pts)
    3. start_date and end_date are set and valid (start < end) (10 pts)
    4. timezone is set (5 pts)
    5. default_location_id is set OR workshop has virtual delivery type (10 pts)
    6. At least one session exists (15 pts)
    7. At least one confirmed leader is assigned (15 pts)
    8. If any session is virtual/hybrid: meeting_url is set on that session (10 pts)
       If no virtual sessions: full 10 pts automatically
    9. Workshop logistics exist (hotel_name or meetup_instructions filled) (5 pts)
    10. public_visibility is set (if workshop type requires it) (10 pts)

  total_score = sum of earned points (max 100)

  Response per workshop:
  {
    workshop_id, title, organization_id, organization_name, status,
    readiness_score: int,
    missing_items: [string],  // human-readable list of what's missing
    ready_to_publish: bool    // score >= 80
  }

  Order by readiness_score ASC (worst first) so action items are at top.

git add . && git commit -m "feat(cc-gap1-task3): workshop readiness scores route"

═══════════════════════════════════════════════════════════
TASK 4 — LEADER PROFILE COMPLETION ROUTE
═══════════════════════════════════════════════════════════

Add route: Route::get('/organizations/{id}/leader-completion',
  [OrganizationController::class, 'leaderCompletion']);

leaderCompletion():
  For the given org, look at all leaders assigned to org's workshops.
  Join leader_invitations to get invitation status.
  Join leaders table for profile fields.

  A leader profile is "complete" if ALL of these are true:
    - invitation status = 'accepted'
    - bio is not null and length > 20 chars
    - profile_image_url is not null
    - website_url OR at least one contact field filled

  Response:
  {
    organization_id, organization_name,
    total_leaders: int,
    completed_profiles: int,
    incomplete_profiles: int,
    completion_rate_pct: float,
    leaders: [
      {
        leader_id, first_name, last_name, email,
        invitation_status: string,
        profile_complete: bool,
        missing_fields: [string]
      }
    ]
  }

Also add a summary endpoint for the org overview tab:
  Add to the existing GET /organizations/{id} response:
    "leader_completion": {
      "total": int,
      "complete": int,
      "completion_rate_pct": float
    }

git add . && git commit -m "feat(cc-gap1-task4): leader profile completion rate routes"

═══════════════════════════════════════════════════════════
TASK 5 — TESTS: GAP-1 API
═══════════════════════════════════════════════════════════

Create tests/Feature/Platform/WorkshopAuditTest.php:
  - GET /workshops/pricing-audit → 200 with correct shape
  - GET /workshops/pricing-audit?has_pricing=true → filters to paid workshops only
  - GET /workshops/pricing-audit?organization_id={id} → filters to one org
  - GET /workshops/readiness → 200, ordered by readiness_score ASC
  - GET /workshops/readiness?min_score=80 → only workshops scoring >= 80
  - GET /financials/refund-policies → 200 even if table doesn't exist (graceful)
  - GET /organizations/{id}/leader-completion → 200 with correct shape
  - All routes: 403 with tenant token

./vendor/bin/pest tests/Feature/Platform/WorkshopAuditTest.php

git add . && git commit -m "feat(cc-gap1-task5): gap priority 2 API tests"
```

**Merge GAP-1 API:**
```bash
git push origin cc/gap-items-priority2
# Open PR → merge to main
git checkout main && git pull
```

**GAP-1 Frontend:**
```bash
cd wayfield/command
git checkout main && git pull
git checkout -b cc/gap-items-priority2-frontend
```

**Run in:** `cd wayfield/command && claude`

```
You are adding Priority 2 gap items to the Wayfield Command Center frontend.
These are read-only oversight views surfaced within existing CC screens.

Read before writing:
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md

═══════════════════════════════════════════════════════════
PART 1 — WORKSHOP PRICING AUDIT (tab within /organizations/{id})
═══════════════════════════════════════════════════════════

Add a "Workshops" tab to the organisation detail page.
Position: between Billing and Feature Flags.

Tab content: fetch GET /api/platform/v1/workshops/pricing-audit?organization_id={id}

TABLE: Title | Status badge | Paid? | Base Price | Deposit | Active Tiers | Add-On Sessions
  Title: font-sans text-sm font-medium gray-900
  Status: <StatusBadge />
  Paid: CheckCircle teal or XCircle gray-300 (with aria-label)
  Base Price: if is_paid: "{currency} {amount formatted}" font-mono | else "Free"
  Deposit: if deposit_enabled: "{amount}" font-mono | else "—"
  Active Tiers: int font-mono | 0 = "—"
  Add-On Sessions: int font-mono | 0 = "—"

Filter within tab: has_pricing toggle (All / Paid only / Free only)

If workshop_pricing table doesn't exist: show info banner
  "Pricing data not available — payment system not yet configured."

Readiness mini-indicator: show a small colored dot beside each workshop title
  Score >= 80: teal dot (aria-label="Ready")
  Score 50-79: amber dot (aria-label="Needs attention")
  Score < 50: red dot (aria-label="Incomplete")
  Fetch readiness scores from /workshops/readiness?organization_id={id}
  in parallel with pricing data. Show skeletons while either is loading.

git add . && git commit -m "feat(cc-web-gap1-part1): workshop pricing + readiness tab in org detail"

═══════════════════════════════════════════════════════════
PART 2 — READINESS SCORES (standalone page link from Overview)
═══════════════════════════════════════════════════════════

Add a "Workshop Readiness" section to the CC Overview page (/),
below the existing stat cards and plan distribution panels.

Heading: "Workshop Readiness" (Sora 16px font-semibold gray-900)
Subtitle: "Draft workshops sorted by readiness score (lowest first)"

Fetch: GET /api/platform/v1/workshops/readiness?status=draft&max_score=79
(Show only draft workshops that need attention — score < 80)
Limit to 10 rows. "View all →" link text.

TABLE: Organisation | Workshop | Score | Missing Items | Ready?
  Score: colored badge — red (<50), amber (50-79), teal (≥80)
  Missing Items: comma-joined list, truncated at 60 chars
  Ready?: "Yes" teal text or "No" red text

If no workshops under 80: show teal success state
  CheckCircle (teal 24px) + "All draft workshops score 80+ — good shape!" gray-600

Loading: skeleton rows. Error: <ErrorBanner />.

git add . && git commit -m "feat(cc-web-gap1-part2): workshop readiness section on overview"

═══════════════════════════════════════════════════════════
PART 3 — LEADER COMPLETION RATE (in org detail overview tab)
═══════════════════════════════════════════════════════════

Update the org detail Overview tab (/organizations/{id}?tab=overview).

The existing GET /organizations/{id} response now includes leader_completion.
Add a Leader Profiles stat mini-card to the right column (below Managers card):

  Card: bg-white rounded-xl border border-gray-200 p-4
  Label: "LEADER PROFILES" font-mono text-xs uppercase text-gray-400
  Value: "{complete} / {total}" font-heading text-2xl font-bold gray-900
    Color the value:
      All complete: text-teal-600
      Some incomplete: text-amber-600
      Most incomplete (<50%): text-red-600
  Subtitle: "{completion_rate_pct}% complete" text-sm gray-500
  Link: "View details →" text-xs text-[#0FA3B1] mt-2 (links to a future leader detail view)

git add . && git commit -m "feat(cc-web-gap1-part3): leader profile completion rate in org overview"

═══════════════════════════════════════════════════════════
PART 4 — REFUND POLICY AUDIT (tab in /financials)
═══════════════════════════════════════════════════════════

Add a "Refund Policies" tab to the /financials page.
Position: after Stripe Connect.

SUMMARY CARDS (grid-cols-4 gap-4 mb-6):
  Platform Policies | Org Policies | Workshop Policies | Workshops Without Policy

  "Workshops Without Policy" card: red alertLevel if count > 0

Info note if count > 0:
  bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4
  "{count} paid workshops have no refund policy configured.
   Participants cannot see refund terms — this may affect trust and conversions."

FILTER BAR: policy_level (Platform/Org/Workshop) | organization search

TABLE: Level | Organisation | Workshop | Type | Active | Preview | Created
  Level badge: platform=purple, org=blue, workshop=teal
  Active: CheckCircle/XCircle with aria-label
  Preview: truncated policy text (60 chars) + expand on click

If refund_policies table unavailable: show info state
  "Refund policy data not available — payment system not yet configured."

git add . && git commit -m "feat(cc-web-gap1-part4): refund policy audit in financials"

═══════════════════════════════════════════════════════════
PART 5 — TESTS
═══════════════════════════════════════════════════════════

  - Org detail shows "Workshops" tab
  - Pricing table shows "Free" for unpriced workshops, formatted price for paid
  - Readiness dot uses teal/amber/red with aria-labels (not color alone)
  - Overview page shows readiness section, only draft workshops < 80 score
  - All-green state shows success message instead of table
  - Leader Profiles card color: teal when all complete, amber/red otherwise
  - Financials Refund Policies tab: summary cards show correct counts
  - Workshops Without Policy card shows red alertLevel when count > 0
  - Info banner shows when workshops_without_policy > 0

git add . && git commit -m "feat(cc-web-gap1-part5): gap priority 2 frontend tests"
```

**Merge GAP-1 Frontend:**
```bash
git push origin cc/gap-items-priority2-frontend
# Open PR → merge to main
git checkout main && git pull
```

---

# PHASE GAP-2
# Priority 3 Gap Items: SES Email Audit, Failed Payments,
# Notification Audit, Session Pricing

**Prerequisite:** CC Phase 2 (health monitor) is merged and live.

```bash
cd wayfield/api
git checkout main && git pull
git checkout -b cc/gap-items-priority3
```

**Run in:** `cd wayfield/api && claude`

```
You are adding Priority 3 gap items to the Wayfield Command Center API.
These are additional read-only oversight views for email delivery,
payment failures, notification volume, and add-on session pricing.

NON-NEGOTIABLE:
  Route prefix: /api/platform/v1/
  Guard: auth:platform_admin + platform.auth
  All routes READ ONLY — no mutations.
  Always return a valid response even if underlying tables don't exist.
  Never fail — use Schema::hasTable guards and return { unavailable: true } shapes.

═══════════════════════════════════════════════════════════
TASK 1 — PER-ORG EMAIL DELIVERY STATS
═══════════════════════════════════════════════════════════

Add route: Route::get('/organizations/{id}/email-stats', [EmailAuditController::class, 'orgStats']);
Add route: Route::get('/health/email-by-org', [EmailAuditController::class, 'byOrg']);

Create: app/Http/Controllers/Api/Platform/EmailAuditController.php

orgStats():
  If email_logs table doesn't exist: return { unavailable: true }
  From email_logs for this organization's users (join through org membership):
    Count total sent last 30 days
    Count delivered, bounced, complained
    Compute delivery_rate, bounce_rate, complaint_rate
    Return top 5 most-bounced email addresses
  Response: { total_sent, delivered, bounced, complained,
    delivery_rate_pct, bounce_rate_pct, complaint_rate_pct,
    high_bounce_addresses: [{ email, bounce_count }], period_days: 30 }

byOrg():
  Paginated list of all orgs with their email stats (summary only).
  Filters: min_bounce_rate (float — surface problem orgs)
  Ordered by bounce_rate DESC.
  Response per org: { organization_id, name, total_sent_30d, bounce_rate_pct, complaint_rate_pct }
  Alert threshold: flag orgs with bounce_rate_pct > 5.0

git add . && git commit -m "feat(cc-gap2-task1): per-org email delivery stats routes"

═══════════════════════════════════════════════════════════
TASK 2 — FAILED PAYMENTS AUDIT
═══════════════════════════════════════════════════════════

Add route: Route::get('/financials/failed-payments', [FinancialsController::class, 'failedPayments']);

failedPayments():
  Query stripe_events table (if exists) for event_type LIKE 'payment_intent.payment_failed'
  OR query orders table (if exists) for status = 'failed'
  Use whichever source is available. Guard with Schema::hasTable.

  From stripe_events (preferred):
    Parse payload_json for: amount, currency, error message, customer email
    Join stripe_customers to get organization_id

  Response per failure:
  {
    event_id, organization_id, organization_name,
    amount_cents, currency, failure_reason, customer_email,
    occurred_at
  }

  Filters: organization_id, date_from, date_to, page 25/page
  Ordered by occurred_at DESC (newest first)

  If no source available: { data: [], unavailable_reason: 'Stripe webhook not wired' }

git add . && git commit -m "feat(cc-gap2-task2): failed payments audit route"

═══════════════════════════════════════════════════════════
TASK 3 — NOTIFICATION DELIVERY AUDIT
═══════════════════════════════════════════════════════════

Add route: Route::get('/notifications/audit', [NotificationAuditController::class, 'index']);

Create: app/Http/Controllers/Api/Platform/NotificationAuditController.php

index():
  If notifications table doesn't exist: return { unavailable: true }
  
  Query params: type (notification type), organization_id, date_from, date_to, page 50/page

  From notifications table (join through organization/workshop relationships):
    Aggregate: total sent, by type, by channel (email/push/in_app)
    Recent delivery status if status column exists

  Summary response:
  {
    summary: {
      total_30d: int,
      by_type: { [type]: count },
      by_channel: { email: int, push: int, in_app: int }
    },
    data: [paginated notification records with org context]
  }

git add . && git commit -m "feat(cc-gap2-task3): notification delivery audit route"

═══════════════════════════════════════════════════════════
TASK 4 — ADD-ON SESSION PRICING OVERSIGHT
═══════════════════════════════════════════════════════════

Add route: Route::get('/workshops/addon-pricing', [WorkshopAuditController::class, 'addonPricing']);

addonPricing():
  If session_pricing table doesn't exist: return { data: [], unavailable: true }
  
  Join sessions + workshops + organizations + session_pricing.
  Only sessions where session_type IN ('addon','invite_only') (if column exists).

  Query params: organization_id, page 25/page

  Response per session:
  {
    session_id, session_title, workshop_id, workshop_title,
    organization_id, organization_name, session_type,
    pricing: { base_price_cents, currency, deposit_enabled }
  }

  Summary at top: { total_priced_sessions, total_orgs_with_addon_pricing }

git add . && git commit -m "feat(cc-gap2-task4): add-on session pricing oversight route"

═══════════════════════════════════════════════════════════
TASK 5 — TESTS: GAP-2 API
═══════════════════════════════════════════════════════════

Create tests/Feature/Platform/EmailAuditTest.php:
  - GET /organizations/{id}/email-stats → 200 (even if email_logs doesn't exist)
  - Returns { unavailable: true } when email_logs table absent
  - GET /health/email-by-org → 200 paginated
  - min_bounce_rate filter works when table exists

Create tests/Feature/Platform/FinancialAuditTest.php:
  - GET /financials/failed-payments → 200 (graceful when stripe_events empty)
  - Returns { data: [] } when no failures found
  - 403 with tenant token

Create tests/Feature/Platform/NotificationAuditTest.php:
  - GET /notifications/audit → 200 (graceful when table doesn't exist)
  - Returns { unavailable: true } when notifications table absent

./vendor/bin/pest tests/Feature/Platform/

git add . && git commit -m "feat(cc-gap2-task5): gap priority 3 API tests"
```

**Merge GAP-2 API:**
```bash
git push origin cc/gap-items-priority3
# Open PR → merge to main
git checkout main && git pull
```

**GAP-2 Frontend:**
```bash
cd wayfield/command
git checkout main && git pull
git checkout -b cc/gap-items-priority3-frontend
```

**Run in:** `cd wayfield/command && claude`

```
You are adding Priority 3 gap items to the Wayfield Command Center frontend.

Read before writing:
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md

═══════════════════════════════════════════════════════════
PART 1 — EMAIL AUDIT IN HEALTH MONITOR (/health)
═══════════════════════════════════════════════════════════

Add an "Email by Organisation" section to the Health Monitor page.
Position: below the existing SES delivery stats section.

Heading: "Email Delivery by Organisation" (Sora 16px)
Note: "Organisations with bounce rate > 5% may risk SES suspension."

Fetch: GET /api/platform/v1/health/email-by-org

If unavailable: info card "Email log data not available."

TABLE: Organisation | Sent (30d) | Bounce Rate | Complaint Rate | Status
  Bounce Rate: "{X.X}%" font-mono
    > 5%: red text + bg-red-50 row highlight
    2–5%: amber text
    < 2%: gray text
  Complaint Rate: same thresholds (complaint > 0.1% is serious)
  Status: "⚠ High bounce" red badge | "OK" teal badge | "—" gray

Filter: min_bounce_rate slider or input (show orgs above threshold only)

git add . && git commit -m "feat(cc-web-gap2-part1): per-org email delivery in health monitor"

═══════════════════════════════════════════════════════════
PART 2 — FAILED PAYMENTS IN FINANCIALS (/financials)
═══════════════════════════════════════════════════════════

Add "Failed Payments" tab to /financials.
Position: after Refund Policies.

Fetch: GET /api/platform/v1/financials/failed-payments

If unavailable (Stripe webhook not wired):
  Info card: "Failed payment data requires the Stripe webhook to be connected.
   See OPEN_QUESTIONS Q4 for details."
  Show amber AlertTriangle icon.

If available:
  FILTER BAR: organisation search | date_from | date_to
  TABLE: Organisation | Amount | Failure Reason | Customer Email | Date/Time
    Amount: formatted currency, font-mono
    Failure Reason: text-sm gray-700, truncated 80 chars
    Date/Time: font-mono text-xs gray-400
  Read only. No actions.
  Empty state: "No failed payments in the selected period."

git add . && git commit -m "feat(cc-web-gap2-part2): failed payments tab in financials"

═══════════════════════════════════════════════════════════
PART 3 — ADD-ON PRICING IN ORGANISATION DETAIL
═══════════════════════════════════════════════════════════

Add an "Add-On Sessions" section to the Workshops tab of org detail.
(Below the main workshop pricing table, as a collapsible sub-section)

Heading: "Add-On Session Pricing" with ChevronDown toggle.

Fetch: GET /api/platform/v1/workshops/addon-pricing?organization_id={id}

If unavailable or empty: "No add-on session pricing configured for this organisation."

TABLE: Session | Workshop | Type (badge) | Price | Deposit
  Type badge: addon=teal, invite_only=purple
  Price: formatted or "Free"
  Deposit: amount or "—"

git add . && git commit -m "feat(cc-web-gap2-part3): add-on session pricing in org workshops tab"

═══════════════════════════════════════════════════════════
PART 4 — TESTS
═══════════════════════════════════════════════════════════

  - Health monitor email section: red row highlight for > 5% bounce rate
  - Bounce rate uses color + text label (not color alone) — Apple HIG
  - Failed payments tab: shows unavailable state with amber icon when webhook not wired
  - Failed payments: shows empty state when no failures in period
  - Add-on pricing section: collapsible, shows empty state when none configured

git add . && git commit -m "feat(cc-web-gap2-part4): gap priority 3 frontend tests"
```

**Merge GAP-2 Frontend:**
```bash
git push origin cc/gap-items-priority3-frontend
# Open PR → merge to main
git checkout main && git pull
```

---

## Complete Branch and Merge Sequence

```
feat/plan-code-rename          → merge first (DB rename)
cc/payments-api                → merge after DB rename (or skip if in main CC guide)
cc/payments-frontend           → merge after payments API (or skip if in main CC guide)
cc/gap-items-priority2         → merge after CC Phase 1 is live
cc/gap-items-priority2-frontend → merge after gap-items-priority2
cc/gap-items-priority3         → merge after CC Phase 2 is live
cc/gap-items-priority3-frontend → merge after gap-items-priority3
```

---

## Decisions to Add to DECISIONS.md

| ID | Decision |
|----|----------|
| DEC-RENAME-001 | Plan DB codes permanently renamed: free→foundation, starter→creator, pro→studio, enterprise unchanged. Effective from merge of feat/plan-code-rename. All new code must use new codes. |
| DEC-RENAME-002 | platform_take_rates.plan_code was already using foundation/creator/studio/custom and did not require updating in the rename. |
| DEC-CC-017 | Plan display names in CC UI are Foundation/Creator/Studio/Enterprise. After DEC-RENAME-001, DB codes and display names are now aligned (foundation=Foundation etc.) |
| DEC-CC-018 | Studio plan (formerly pro) price is $149/month. |
| DEC-CC-019 | Platform payments_enabled toggle requires type-to-confirm ("DISABLE") in CC UI. |
| DEC-CC-020 | Take rate edits are super_admin only. Billing role can toggle payment flags but cannot change take rates. |
| DEC-CC-021 | Stripe Connect accounts are read-only in CC. Managed in Stripe Dashboard only. |
| DEC-CC-022 | Announcements is a standalone nav item in System group — not inside Settings. |
| DEC-CC-023 | After the rename, platform_take_rates.plan_code and subscriptions.plan_code use the same vocabulary (foundation/creator/studio). custom in take_rates maps to Enterprise. |
| DEC-CC-024 | All gap item routes return graceful responses when underlying tables don't exist. Never fail — return { unavailable: true } shape instead. |
| DEC-CC-025 | Workshop readiness score threshold: >= 80 = ready to publish. < 80 = needs attention. < 50 = incomplete. |
| DEC-CC-026 | Workshop pricing, refund policy, and notification audits are read-only oversight views. No mutations from the CC on these items. |
