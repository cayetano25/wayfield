<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * We use a raw DB::statement here instead of Schema::table with ->change()
     * because modifying ENUM columns via the Doctrine DBAL abstraction layer
     * requires the doctrine/dbal package and can behave unpredictably with
     * MySQL ENUM types. A raw ALTER TABLE is deterministic and avoids that
     * dependency entirely. This is safe on MySQL 8.
     *
     * The existing UNIQUE(provider, provider_user_id) index is unaffected
     * because we are only extending the allowed enum values.
     *
     * SQLite: ENUM is stored as TEXT and does not enforce values at the DB level,
     * so no ALTER is needed — 'saml' and 'oidc' are accepted by SQLite immediately.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE auth_methods
                MODIFY COLUMN provider
                ENUM('email','google','facebook','saml','oidc') NOT NULL");
        }
        // SQLite stores ENUM as TEXT; all values are accepted without schema changes.
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            // Revert to original enum values.
            // Existing rows with 'saml' or 'oidc' must be removed first in production.
            DB::statement("ALTER TABLE auth_methods
                MODIFY COLUMN provider
                ENUM('email','google','facebook') NOT NULL");
        }
    }
};
