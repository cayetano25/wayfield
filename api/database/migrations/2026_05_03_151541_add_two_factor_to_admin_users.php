<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('admin_users', function (Blueprint $table) {
            // Encrypted TOTP secret. NULL = 2FA not configured.
            $table->text('two_factor_secret')->nullable()->after('password_hash');
            // JSON array of bcrypt-hashed recovery codes. NULL = not configured.
            $table->text('two_factor_recovery_codes')->nullable()->after('two_factor_secret');
            // Set when admin confirms setup. NULL = setup incomplete.
            $table->dateTime('two_factor_confirmed_at')->nullable()->after('two_factor_recovery_codes');
            // If true: admin cannot access CC until 2FA is configured.
            $table->boolean('two_factor_required')->default(false)->after('two_factor_confirmed_at');
        });
    }

    public function down(): void
    {
        Schema::table('admin_users', function (Blueprint $table) {
            $table->dropColumn([
                'two_factor_secret',
                'two_factor_recovery_codes',
                'two_factor_confirmed_at',
                'two_factor_required',
            ]);
        });
    }
};
