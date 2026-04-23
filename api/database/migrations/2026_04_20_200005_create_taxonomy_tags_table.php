<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('taxonomy_tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tag_group_id')
                ->constrained('taxonomy_tag_groups')
                ->cascadeOnDelete();
            $table->string('value', 100)->notNull();
            $table->string('label', 100)->notNull();
            $table->smallInteger('sort_order')->unsigned()->notNull()->default(0);
            $table->boolean('is_active')->notNull()->default(true);
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->unique(['tag_group_id', 'value']);
            $table->index(['tag_group_id', 'sort_order']);
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('taxonomy_tags');
    }
};
