<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_take_rates', function (Blueprint $table) {
            $table->id();
            $table->enum('plan_code', ['foundation', 'creator', 'studio', 'custom'])->notNull()->unique();
            $table->decimal('take_rate_pct', 5, 4)->notNull();
            $table->boolean('is_active')->notNull()->default(true);
            $table->text('notes')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_take_rates');
    }
};
