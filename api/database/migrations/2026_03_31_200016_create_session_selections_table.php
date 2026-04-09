<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_selections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('registration_id')->constrained()->cascadeOnDelete();
            $table->foreignId('session_id')->constrained()->cascadeOnDelete();
            $table->enum('selection_status', ['selected', 'canceled', 'waitlisted'])
                ->default('selected');
            $table->timestamps();

            $table->unique(['registration_id', 'session_id']);
            $table->index(['session_id', 'selection_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('session_selections');
    }
};
