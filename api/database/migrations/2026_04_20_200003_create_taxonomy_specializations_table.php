<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('taxonomy_specializations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subcategory_id')
                ->constrained('taxonomy_subcategories')
                ->cascadeOnDelete();
            $table->string('name', 200)->notNull();
            $table->string('slug', 200)->notNull();
            $table->smallInteger('sort_order')->unsigned()->notNull()->default(0);
            $table->boolean('is_active')->notNull()->default(true);
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->unique(['subcategory_id', 'slug']);
            $table->index(['subcategory_id', 'sort_order']);
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('taxonomy_specializations');
    }
};
