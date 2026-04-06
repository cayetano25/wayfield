<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('onboarding_intent', 20)->nullable()->default(null)->after('is_active');
            $table->dateTime('onboarding_completed_at')->nullable()->default(null)->after('onboarding_intent');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['onboarding_intent', 'onboarding_completed_at']);
        });
    }
};
