<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workshop_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 100)->unique();
            $table->text('description')->nullable();
            $table->string('seo_title', 255)->nullable();
            $table->text('seo_description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
        });

        Schema::create('workshop_category_workshop', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workshop_category_id')
                ->constrained('workshop_categories')
                ->cascadeOnDelete();
            $table->foreignId('workshop_id')
                ->constrained('workshops')
                ->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['workshop_category_id', 'workshop_id'], 'wcw_category_workshop_unique');
            $table->index('workshop_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workshop_category_workshop');
        Schema::dropIfExists('workshop_categories');
    }
};
