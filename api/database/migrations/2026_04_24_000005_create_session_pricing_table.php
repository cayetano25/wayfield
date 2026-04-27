<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_pricing', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')
                ->unique()
                ->constrained('sessions')
                ->cascadeOnDelete();
            $table->unsignedInteger('price_cents')->notNull()->default(0);
            $table->char('currency', 3)->notNull()->default('usd');
            $table->boolean('is_nonrefundable')->notNull()->default(false);
            $table->unsignedInteger('max_purchases')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index('price_cents');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('session_pricing');
    }
};
