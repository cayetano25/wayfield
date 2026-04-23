<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('taxonomy_subcategories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')
                ->constrained('taxonomy_categories')
                ->cascadeOnDelete();
            $table->string('name', 150)->notNull();
            $table->string('slug', 150)->notNull();
            $table->smallInteger('sort_order')->unsigned()->notNull()->default(0);
            $table->boolean('is_active')->notNull()->default(true);
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->unique(['category_id', 'slug']);
            $table->index(['category_id', 'sort_order']);
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('taxonomy_subcategories');
    }
};
