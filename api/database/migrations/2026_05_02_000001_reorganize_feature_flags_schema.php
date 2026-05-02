<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Rename existing per-org override table to its correct name
        Schema::rename('feature_flags', 'organization_feature_flags');

        // Add the platform-admin tracking column
        Schema::table('organization_feature_flags', function (Blueprint $table) {
            $table->unsignedBigInteger('set_by_admin_user_id')->nullable()->after('source');
        });

        // Create the platform-wide feature flag definitions catalog
        Schema::create('feature_flags', function (Blueprint $table) {
            $table->id();
            $table->string('feature_key', 100)->unique();
            $table->text('description')->nullable();
            $table->boolean('default_enabled')->default(false);
            $table->json('plan_defaults')->nullable();
            $table->timestamps();
        });

        // Seed the initial catalog
        $now = now();
        DB::table('feature_flags')->insert([
            ['feature_key' => 'analytics',       'description' => 'Advanced analytics dashboard',     'default_enabled' => false, 'plan_defaults' => '{"free":false,"starter":false,"pro":true,"enterprise":true}',   'created_at' => $now, 'updated_at' => $now],
            ['feature_key' => 'api_access',       'description' => 'API and webhook access',           'default_enabled' => false, 'plan_defaults' => '{"free":false,"starter":false,"pro":true,"enterprise":true}',   'created_at' => $now, 'updated_at' => $now],
            ['feature_key' => 'leader_messaging', 'description' => 'Leader day-of-session notifications', 'default_enabled' => true,  'plan_defaults' => '{"free":false,"starter":true,"pro":true,"enterprise":true}',    'created_at' => $now, 'updated_at' => $now],
            ['feature_key' => 'waitlists',        'description' => 'Session waitlists',                'default_enabled' => false, 'plan_defaults' => '{"free":false,"starter":true,"pro":true,"enterprise":true}',    'created_at' => $now, 'updated_at' => $now],
            ['feature_key' => 'custom_branding',  'description' => 'Custom branding and logo',         'default_enabled' => false, 'plan_defaults' => '{"free":false,"starter":false,"pro":false,"enterprise":true}',  'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('feature_flags');

        Schema::table('organization_feature_flags', function (Blueprint $table) {
            $table->dropColumn('set_by_admin_user_id');
        });

        Schema::rename('organization_feature_flags', 'feature_flags');
    }
};
