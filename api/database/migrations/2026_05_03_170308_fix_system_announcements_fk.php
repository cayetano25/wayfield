<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Drop the FK constraint to the deprecated platform_admins table.
    // Per COMMAND_CENTER_SCHEMA.md: "FK to admin_users — not enforced as
    // constraint (admin may be deleted)". Column kept as a plain integer.
    public function up(): void
    {
        Schema::table('system_announcements', function (Blueprint $table) {
            $table->dropForeign(['created_by_admin_id']);
        });
    }

    public function down(): void
    {
        // Intentionally not restoring — platform_admins is deprecated (AR-10).
    }
};
