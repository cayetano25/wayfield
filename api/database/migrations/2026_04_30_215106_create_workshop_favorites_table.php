<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workshop_favorites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                  ->constrained()->onDelete('cascade');
            $table->foreignId('workshop_id')
                  ->constrained()->onDelete('cascade');
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['user_id', 'workshop_id']);
            $table->index('user_id');
            $table->index('workshop_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workshop_favorites');
    }
};
