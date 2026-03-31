# Wayfield API — Laravel Context

This is the Laravel backend API for Wayfield.
Root project memory: ../CLAUDE.md
Constitutional authority: ../MASTER_PROMPT.md
Schema: ../docs/03_schema/DATA_SCHEMA_FULL.md
API routes: ../docs/04_api/API_ROUTE_SPEC.md
Module structure: ../docs/05_architecture/MODULE_BOUNDARIES.md
Laravel patterns: ../docs/06_implementation/LARAVEL_IMPLEMENTATION_PLAN.md

## Laravel Specifics

- Laravel version: 13.x
- Auth: Laravel Sanctum (Bearer tokens)
- Password column: `password_hash` (not Laravel default `password`)
  Override getAuthPassword() and getAuthPasswordName() on User model.
- Custom password_reset_tokens table (token_hash + expires_at, not Laravel default)
- user_sessions table coexists with Sanctum's personal_access_tokens as an audit record
- Module structure: app/Domain/{Module}/Actions/, Services/
- All business logic in Actions or Services — controllers stay thin
- Tests: Pest (not PHPUnit directly)

## Commands
```bash
php artisan serve          # start dev server on :8000
php artisan migrate        # run migrations
php artisan migrate:fresh  # reset and re-run all migrations
./vendor/bin/pest          # run test suite
./vendor/bin/pest --filter=RegisterTest  # run single test class
php artisan route:list     # see all registered routes
php artisan queue:work     # start queue worker
```

## Do Not

- Do not use Laravel Fortify or Breeze — this is a pure API
- Do not use a single `name` field — always first_name + last_name
- Do not move enforcement to UI layer
- Do not expose password_hash in any response
