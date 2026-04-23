<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workshop_tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workshop_id')
                ->constrained('workshops')
                ->cascadeOnDelete();
            $table->foreignId('tag_id')
                ->constrained('taxonomy_tags')
                ->cascadeOnDelete();
            $table->dateTime('created_at')->useCurrent();

            $table->unique(['workshop_id', 'tag_id']);
            $table->index('tag_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workshop_tags');
    }
};
