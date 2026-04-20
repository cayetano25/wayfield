<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_invitations', function (Blueprint $table) {
            // Add the invitee's user account FK (null until accepted, or until
            // the email is matched to an existing account at invitation time).
            $table->foreignId('user_id')
                ->nullable()
                ->after('organization_id')
                ->constrained('users')
                ->nullOnDelete();

            $table->index('user_id');

            // Remove owner from the role enum — owner is set at org creation
            // only and is never granted via invitation.
            $table->enum('role', ['admin', 'staff', 'billing_admin'])
                ->change();
        });
    }

    public function down(): void
    {
        Schema::table('organization_invitations', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropIndex(['user_id']);
            $table->dropColumn('user_id');

            $table->enum('role', ['owner', 'admin', 'staff', 'billing_admin'])
                ->change();
        });
    }
};
