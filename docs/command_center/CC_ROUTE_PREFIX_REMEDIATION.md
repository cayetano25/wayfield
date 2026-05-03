# CC Route Prefix Remediation
## docs/command_center/CC_ROUTE_PREFIX_REMEDIATION.md

> **Run this before CC-Web Phase 0 frontend.**
> **Do not start any frontend work until this prompt is complete and tests pass.**
>
> Issue: The bulk of the CC API is registered at `/api/v1/platform/*` (wrong)
> instead of `/api/platform/v1/*` (correct).
> Auth endpoints are already correct — do not touch those.
>
> This prompt moves the routes and updates all affected tests.

---

## Remediation Prompt

**Run in:** `cd wayfield/api && claude`
**Branch:** `git checkout -b cc/fix-route-prefix`

```
You are fixing a route prefix error in the Wayfield Command Center API.

The bulk of the CC API routes are registered at the wrong prefix.

WRONG:   /api/v1/platform/*    (this is where they currently live in api.php ~line 578)
CORRECT: /api/platform/v1/*    (this is the canonical prefix per COMMAND_CENTER_OVERVIEW.md)

The auth endpoints (login, logout, me) are already correctly placed.
Do not touch those. Do not touch any tenant /api/v1/* routes.

Read before writing:
@../docs/command_center/COMMAND_CENTER_OVERVIEW.md
@../docs/command_center/COMMAND_CENTER_BUILD_PLAN.md

NON-NEGOTIABLE: After this fix, a request to any old /api/v1/platform/* route
(except auth endpoints if they live there) must return 404.
A request to /api/platform/v1/* must return the correct response.
No route must silently serve both prefixes.

═══════════════════════════════════════════════════════════
STEP 1 — AUDIT: READ THE CURRENT STATE
═══════════════════════════════════════════════════════════

Before changing anything, read and report exactly what exists:

1A. Show all platform-related routes currently registered:
  php artisan route:list | grep -i platform

1B. Read the relevant section of routes/api.php (around line 578):
  sed -n '560,620p' routes/api.php

1C. Check routes/platform.php exists and what it contains:
  cat routes/platform.php 2>/dev/null || echo "FILE NOT FOUND"

1D. Find all test files that reference the wrong prefix:
  grep -rn "v1/platform\|api/v1/platform" tests/ | grep -v ".php:#"

Report the full output of each command before proceeding.
Do not write any code until you have read and understood the current state.

═══════════════════════════════════════════════════════════
STEP 2 — IDENTIFY THE ROUTES TO MOVE
═══════════════════════════════════════════════════════════

From the audit in Step 1, identify:

A. Which routes are at /api/v1/platform/* and need to move to /api/platform/v1/*
B. Which routes are already at /api/platform/v1/* and must NOT be touched
C. Which test files reference the old /api/v1/platform/* prefix

List all three groups clearly before writing any code.

The canonical correct prefix for ALL platform routes is: /api/platform/v1/
Examples of correct paths:
  POST /api/platform/v1/auth/login
  POST /api/platform/v1/auth/logout
  GET  /api/platform/v1/me
  GET  /api/platform/v1/overview
  GET  /api/platform/v1/organizations

═══════════════════════════════════════════════════════════
STEP 3 — MOVE THE ROUTES
═══════════════════════════════════════════════════════════

Strategy: centralize ALL platform routes in routes/platform.php
under the correct prefix. Remove the wrongly-prefixed block from routes/api.php.

3A. ENSURE routes/platform.php EXISTS AND IS REGISTERED

Check if routes/platform.php is already registered in bootstrap/app.php
or RouteServiceProvider:
  grep -rn "platform.php" bootstrap/ app/Providers/ routes/

If NOT registered, add it. The file must be loaded with the 'api' middleware group
and NO prefix (the prefix is declared inside the file itself):

  Laravel 11 (bootstrap/app.php):
    ->withRouting(function (Router $router) {
        // Existing routes...
        $router->middleware('api')
               ->group(base_path('routes/platform.php'));
    })

  Laravel 10 (RouteServiceProvider.php boot()):
    Route::middleware('api')
         ->group(base_path('routes/platform.php'));

3B. MOVE ROUTES FROM api.php TO platform.php

Open routes/api.php. Find the /api/v1/platform/* block (around line 578).
Copy all routes from that block.

In routes/platform.php, ensure the structure is:

<?php
declare(strict_types=1);

use Illuminate\Support\Facades\Route;
// Import all controller classes used by platform routes

// ─── Public platform routes (no auth) ────────────────────────────────────────
Route::prefix('api/platform/v1')->group(function () {

    Route::post('/auth/login', [PlatformAuthController::class, 'login']);

    // ─── Authenticated platform routes ─────────────────────────────────────
    Route::middleware(['auth:platform_admin', 'platform.auth'])->group(function () {

        Route::post('/auth/logout', [PlatformAuthController::class, 'logout']);
        Route::get('/me',           [PlatformAuthController::class, 'me']);
        Route::get('/overview',     [OverviewController::class, 'index']);

        // --- paste all the routes moved from api.php here ---
        // Preserve all existing route definitions exactly.
        // Only change the prefix context — not the controller references,
        // not the middleware, not the parameter names.

    });
});

3C. REMOVE THE OLD BLOCK FROM api.php

After confirming all routes are in platform.php and the file is registered:
Delete the /api/v1/platform/* route group from routes/api.php entirely.
Do not leave a comment stub. Do not leave a redirect. Remove it cleanly.

3D. VERIFY NO DUPLICATE ROUTES

  php artisan route:list | grep platform

Every platform route must appear exactly once.
No route should appear at both /api/v1/platform/* and /api/platform/v1/*.
If any duplicate appears: stop and resolve before proceeding.

═══════════════════════════════════════════════════════════
STEP 4 — UPDATE ALL AFFECTED TESTS
═══════════════════════════════════════════════════════════

Find every test file that references the old prefix:
  grep -rn "api/v1/platform\|v1/platform" tests/

For each occurrence, replace the old URL with the correct one:
  OLD: /api/v1/platform/...
  NEW: /api/platform/v1/...

This includes (but is not limited to):
  tests/Feature/Platform/PlatformAdminAccessTest.php
  Any other test file returned by the grep above.

IMPORTANT: Do not change any test that references /api/v1/ routes
that are NOT platform routes. Only touch platform route URLs.

After updating, verify the replacements are correct:
  grep -rn "api/v1/platform" tests/
Expected result: zero matches. All platform test URLs now use /api/platform/v1/.

═══════════════════════════════════════════════════════════
STEP 5 — RUN THE TEST SUITE
═══════════════════════════════════════════════════════════

Run the full test suite:
  ./vendor/bin/pest

Expected: all tests green. No failures.

If platform tests fail with 404: the route is not registered correctly.
  Debug: php artisan route:list | grep platform
  Verify the prefix in platform.php matches /api/platform/v1/

If platform tests fail with 405 (method not allowed): likely a route method mismatch.
  Check the verb (GET/POST/PATCH/DELETE) matches what the test sends.

If tenant tests fail: you have accidentally modified a tenant route.
  Revert that change immediately. Only platform routes move in this remediation.

Do not commit until ALL tests are green.

═══════════════════════════════════════════════════════════
STEP 6 — FINAL VERIFICATION
═══════════════════════════════════════════════════════════

Run these manual checks to confirm the fix:

6A. Old prefix returns 404 (not found — not 403):
  curl -s -o /dev/null -w "%{http_code}" \
    http://localhost:8000/api/v1/platform/overview
  Expected: 404

6B. New prefix returns 401 (unauthenticated — route exists):
  curl -s -o /dev/null -w "%{http_code}" \
    http://localhost:8000/api/platform/v1/overview
  Expected: 401 (because no token — but route is found)

6C. Login still works at correct path:
  curl -s -X POST http://localhost:8000/api/platform/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@wayfieldapp.com","password":"your-password"}'
  Expected: 200 + { token, admin_user }

6D. No platform routes in wrong location:
  php artisan route:list | grep "v1/platform"
  Expected: zero rows

6E. All platform routes at correct location:
  php artisan route:list | grep "platform/v1"
  Expected: all platform routes listed

═══════════════════════════════════════════════════════════
COMMIT AND MERGE
═══════════════════════════════════════════════════════════

Only after all tests pass and all 6 manual checks pass:

  git add routes/api.php routes/platform.php tests/
  git commit -m "fix(cc-api): move platform routes from /api/v1/platform/* to /api/platform/v1/*"

Open a PR. Merge to main before starting CC-Web Phase 0 frontend.

After merge, update .env.local.example in command/ to confirm:
  NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:8000/api/platform/v1
This must match exactly — no trailing slash.
```

---

## Why This Must Be Fixed First

The CC frontend stores the API base URL in `NEXT_PUBLIC_PLATFORM_API_URL`.
Every API call the frontend makes is constructed as:
```
${NEXT_PUBLIC_PLATFORM_API_URL}${path}
```
Which produces: `http://localhost:8000/api/platform/v1/organizations`

If routes live at `/api/v1/platform/*` and the frontend calls `/api/platform/v1/*`,
every single request fails with 404. Debugging this mid-build is painful and
produces confusing error messages that look like CORS or auth issues.

Fixing the routes first means the frontend is built against confirmed-working URLs
from the first request. The `curl` check in Step 6B (401 = route exists, just needs auth)
is the quickest way to confirm a route is registered at the right path before
adding token auth to the picture.

---

## If auth endpoints are at /api/v1/platform/auth/* (wrong prefix too)

Check:
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:8000/api/platform/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}'
```
- If `422`: auth login is already at the correct prefix ✓
- If `404`: auth endpoints also need to move — include them in Step 3B above

The remediation prompt handles both cases since it consolidates everything into
`routes/platform.php` under the correct prefix.
