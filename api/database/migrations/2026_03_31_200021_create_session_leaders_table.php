<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_leaders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('sessions')->cascadeOnDelete();
            $table->foreignId('leader_id')->constrained()->cascadeOnDelete();
            // Optional role label, e.g. "Lead Instructor", "Assistant"
            $table->string('role_label', 100)->nullable();
            $table->timestamps();

            $table->unique(['session_id', 'leader_id']);
            $table->index('leader_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('session_leaders');
    }
};
