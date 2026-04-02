<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feature_flags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('feature_key', 100);
            $table->boolean('is_enabled')->default(false);
            $table->enum('source', ['plan', 'manual_override'])->default('plan');
            $table->timestamps();

            $table->unique(['organization_id', 'feature_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feature_flags');
    }
};
