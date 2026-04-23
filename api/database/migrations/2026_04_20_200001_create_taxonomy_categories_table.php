<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('taxonomy_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->notNull();
            $table->string('slug', 100)->notNull()->unique();
            $table->smallInteger('sort_order')->unsigned()->notNull()->default(0);
            $table->boolean('is_active')->notNull()->default(true);
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index('sort_order');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('taxonomy_categories');
    }
};
