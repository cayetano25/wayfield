<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            // System-generated notifications (e.g. invitation notifications) may not
            // be scoped to a workshop and have no human creator.
            $table->foreignId('workshop_id')->nullable()->change();
            $table->foreignId('created_by_user_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('workshop_id')->nullable(false)->change();
            $table->foreignId('created_by_user_id')->nullable(false)->change();
        });
    }
};
