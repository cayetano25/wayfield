<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workshops', function (Blueprint $table) {
            $table->string('header_image_url', 1000)->nullable()->after('public_slug');
        });

        Schema::table('sessions', function (Blueprint $table) {
            $table->string('header_image_url', 1000)->nullable()->after('is_published');
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->string('logo_url', 1000)->nullable()->after('status');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('profile_image_url', 1000)->nullable()->after('last_login_at');
        });
    }

    public function down(): void
    {
        Schema::table('workshops', function (Blueprint $table) {
            $table->dropColumn('header_image_url');
        });

        Schema::table('sessions', function (Blueprint $table) {
            $table->dropColumn('header_image_url');
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('logo_url');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('profile_image_url');
        });
    }
};
