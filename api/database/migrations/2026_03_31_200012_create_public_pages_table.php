<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('public_pages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workshop_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('hero_title')->nullable();
            $table->text('hero_subtitle')->nullable();
            $table->longText('body_content')->nullable();
            $table->boolean('is_visible')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('public_pages');
    }
};
