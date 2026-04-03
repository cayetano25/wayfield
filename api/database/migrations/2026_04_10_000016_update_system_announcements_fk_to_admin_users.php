<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Update system_announcements.created_by_admin_id FK from platform_admins → admin_users.
 *
 * The old migration (2026_04_09_000006) pointed this column at platform_admins
 * (the old bridge table). The command center refactor replaces platform_admins
 * with the standalone admin_users table. This migration re-wires the FK.
 *
 * Existing rows: since both tables start empty in fresh environments,
 * no data migration is needed. Any dev seeds using platform_admins will
 * need to be recreated using admin_users.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('system_announcements', function (Blueprint $table) {
            $table->dropForeign(['created_by_admin_id']);
        });

        Schema::table('system_announcements', function (Blueprint $table) {
            $table->foreign('created_by_admin_id')
                ->references('id')
                ->on('admin_users')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('system_announcements', function (Blueprint $table) {
            $table->dropForeign(['created_by_admin_id']);
        });

        Schema::table('system_announcements', function (Blueprint $table) {
            $table->foreign('created_by_admin_id')
                ->references('id')
                ->on('platform_admins')
                ->restrictOnDelete();
        });
    }
};
