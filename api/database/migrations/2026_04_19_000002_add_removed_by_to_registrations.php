<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('registrations', function (Blueprint $table) {
            $table->unsignedBigInteger('removed_by_user_id')->nullable()->after('canceled_at');
            $table->dateTime('removed_at')->nullable()->after('removed_by_user_id');
            $table->string('removal_reason', 255)->nullable()->after('removed_at');

            $table->foreign('removed_by_user_id')->references('id')->on('users')->nullOnDelete();
        });

        // MySQL only — SQLite does not support MODIFY COLUMN and uses dynamic typing.
        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE registrations MODIFY COLUMN registration_status ENUM('registered','canceled','waitlisted','removed') NOT NULL DEFAULT 'registered'");
        }
    }

    public function down(): void
    {
        // Revert any 'removed' rows before shrinking the enum
        DB::statement("UPDATE registrations SET registration_status = 'canceled' WHERE registration_status = 'removed'");
        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE registrations MODIFY COLUMN registration_status ENUM('registered','canceled','waitlisted') NOT NULL DEFAULT 'registered'");
        }

        Schema::table('registrations', function (Blueprint $table) {
            $table->dropForeign(['removed_by_user_id']);
            $table->dropColumn(['removed_by_user_id', 'removed_at', 'removal_reason']);
        });
    }
};
