<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedInteger('balance_amount_cents')
                ->nullable()
                ->after('balance_due_date');

            $table->boolean('balance_auto_charge')
                ->default(true)
                ->after('balance_amount_cents');
        });

        // Extend the orders.status enum to include balance_payment_failed.
        // MODIFY COLUMN is MySQL-only; SQLite (used in tests) has no real enum
        // enforcement so the TEXT column already accepts any value.
        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM(
                'pending',
                'processing',
                'completed',
                'failed',
                'balance_payment_failed',
                'partially_refunded',
                'fully_refunded',
                'cancelled',
                'disputed'
            ) NOT NULL DEFAULT 'pending'");
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM(
                'pending',
                'processing',
                'completed',
                'failed',
                'partially_refunded',
                'fully_refunded',
                'cancelled',
                'disputed'
            ) NOT NULL DEFAULT 'pending'");
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['balance_amount_cents', 'balance_auto_charge']);
        });
    }
};
