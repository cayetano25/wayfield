<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workshop_price_tiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workshop_id')
                ->constrained('workshops')
                ->cascadeOnDelete();
            $table->string('label', 100)->notNull();
            $table->unsignedInteger('price_cents')->notNull();
            $table->dateTime('valid_from')->nullable();
            $table->dateTime('valid_until')->nullable();
            $table->unsignedInteger('capacity_limit')->nullable();
            $table->unsignedInteger('registrations_at_tier')->notNull()->default(0);
            $table->unsignedSmallInteger('sort_order')->notNull()->default(0);
            $table->boolean('is_active')->notNull()->default(true);
            $table->dateTime('reminder_sent_at')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index(['workshop_id', 'is_active', 'sort_order'], 'wpt_workshop_active_sort_idx');
            $table->index(['workshop_id', 'valid_until'], 'wpt_workshop_valid_until_idx');
            $table->index(['workshop_id', 'valid_from'], 'wpt_workshop_valid_from_idx');
            $table->index(['valid_until', 'is_active'], 'wpt_valid_until_active_idx');
            $table->index(['capacity_limit', 'registrations_at_tier'], 'wpt_capacity_registrations_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workshop_price_tiers');
    }
};
