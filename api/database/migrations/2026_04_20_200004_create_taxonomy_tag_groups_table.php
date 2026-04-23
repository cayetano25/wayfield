<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('taxonomy_tag_groups', function (Blueprint $table) {
            $table->id();
            $table->string('key', 60)->notNull()->unique();
            $table->string('label', 100)->notNull();
            $table->string('description', 255)->nullable();
            $table->boolean('allows_multiple')->notNull()->default(true);
            $table->boolean('is_active')->notNull()->default(true);
            $table->smallInteger('sort_order')->unsigned()->notNull()->default(0);
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index(['is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('taxonomy_tag_groups');
    }
};
