<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Widen subscriptions ENUM to accept both old and new values simultaneously
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->enum('plan_code', ['free', 'starter', 'pro', 'enterprise', 'foundation', 'creator', 'studio'])
                ->default('foundation')
                ->change();
        });

        DB::statement("UPDATE subscriptions SET plan_code = 'foundation' WHERE plan_code = 'free'");
        DB::statement("UPDATE subscriptions SET plan_code = 'creator'    WHERE plan_code = 'starter'");
        DB::statement("UPDATE subscriptions SET plan_code = 'studio'     WHERE plan_code = 'pro'");

        // Narrow subscriptions ENUM to only new values
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->enum('plan_code', ['foundation', 'creator', 'studio', 'enterprise'])
                ->default('foundation')
                ->change();
        });

        // Update feature_flags.plan_defaults JSON keys
        if (Schema::hasTable('feature_flags') && Schema::hasColumn('feature_flags', 'plan_defaults')) {
            DB::statement("
                UPDATE feature_flags
                SET plan_defaults = JSON_OBJECT(
                    'foundation', COALESCE(JSON_EXTRACT(plan_defaults, '$.free'), false),
                    'creator',    COALESCE(JSON_EXTRACT(plan_defaults, '$.starter'), false),
                    'studio',     COALESCE(JSON_EXTRACT(plan_defaults, '$.pro'), false),
                    'enterprise', COALESCE(JSON_EXTRACT(plan_defaults, '$.enterprise'), false)
                )
                WHERE plan_defaults IS NOT NULL
                  AND JSON_TYPE(plan_defaults) = 'OBJECT'
            ");
        }

        if (Schema::hasTable('stripe_subscriptions') && Schema::hasColumn('stripe_subscriptions', 'plan_code')) {
            Schema::table('stripe_subscriptions', function (Blueprint $table) {
                $table->enum('plan_code', ['free', 'starter', 'pro', 'enterprise', 'foundation', 'creator', 'studio'])
                    ->change();
            });

            DB::statement("UPDATE stripe_subscriptions SET plan_code = 'foundation' WHERE plan_code = 'free'");
            DB::statement("UPDATE stripe_subscriptions SET plan_code = 'creator'    WHERE plan_code = 'starter'");
            DB::statement("UPDATE stripe_subscriptions SET plan_code = 'studio'     WHERE plan_code = 'pro'");

            Schema::table('stripe_subscriptions', function (Blueprint $table) {
                $table->enum('plan_code', ['foundation', 'creator', 'studio', 'enterprise'])
                    ->change();
            });
        }
    }

    public function down(): void
    {
        // Widen subscriptions ENUM back to accept both old and new values
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->enum('plan_code', ['free', 'starter', 'pro', 'enterprise', 'foundation', 'creator', 'studio'])
                ->default('free')
                ->change();
        });

        DB::statement("UPDATE subscriptions SET plan_code = 'free'    WHERE plan_code = 'foundation'");
        DB::statement("UPDATE subscriptions SET plan_code = 'starter' WHERE plan_code = 'creator'");
        DB::statement("UPDATE subscriptions SET plan_code = 'pro'     WHERE plan_code = 'studio'");

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->enum('plan_code', ['free', 'starter', 'pro', 'enterprise'])
                ->default('free')
                ->change();
        });

        if (Schema::hasTable('feature_flags') && Schema::hasColumn('feature_flags', 'plan_defaults')) {
            DB::statement("
                UPDATE feature_flags
                SET plan_defaults = JSON_OBJECT(
                    'free',       COALESCE(JSON_EXTRACT(plan_defaults, '$.foundation'), false),
                    'starter',    COALESCE(JSON_EXTRACT(plan_defaults, '$.starter'), JSON_EXTRACT(plan_defaults, '$.creator'), false),
                    'pro',        COALESCE(JSON_EXTRACT(plan_defaults, '$.studio'), false),
                    'enterprise', COALESCE(JSON_EXTRACT(plan_defaults, '$.enterprise'), false)
                )
                WHERE plan_defaults IS NOT NULL
                  AND JSON_TYPE(plan_defaults) = 'OBJECT'
            ");
        }

        if (Schema::hasTable('stripe_subscriptions') && Schema::hasColumn('stripe_subscriptions', 'plan_code')) {
            Schema::table('stripe_subscriptions', function (Blueprint $table) {
                $table->enum('plan_code', ['free', 'starter', 'pro', 'enterprise', 'foundation', 'creator', 'studio'])
                    ->change();
            });

            DB::statement("UPDATE stripe_subscriptions SET plan_code = 'free'    WHERE plan_code = 'foundation'");
            DB::statement("UPDATE stripe_subscriptions SET plan_code = 'starter' WHERE plan_code = 'creator'");
            DB::statement("UPDATE stripe_subscriptions SET plan_code = 'pro'     WHERE plan_code = 'studio'");

            Schema::table('stripe_subscriptions', function (Blueprint $table) {
                $table->enum('plan_code', ['free', 'starter', 'pro', 'enterprise'])
                    ->change();
            });
        }
    }
};
