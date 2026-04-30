<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('leaders', function (Blueprint $table) {
            $table->string('social_instagram', 100)->nullable()->after('website_url');
            $table->string('social_twitter', 100)->nullable()->after('social_instagram');
        });
    }

    public function down(): void
    {
        Schema::table('leaders', function (Blueprint $table) {
            $table->dropColumn(['social_instagram', 'social_twitter']);
        });
    }
};
