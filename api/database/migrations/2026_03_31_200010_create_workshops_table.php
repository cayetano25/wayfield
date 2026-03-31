<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workshops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->enum('workshop_type', ['session_based', 'event_based'])->index();
            $table->string('title');
            $table->text('description');
            $table->enum('status', ['draft', 'published', 'archived'])->default('draft');
            $table->string('timezone', 100);
            $table->date('start_date');
            $table->date('end_date');
            $table->string('join_code', 100)->unique();
            $table->foreignId('default_location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->boolean('public_page_enabled')->default(false);
            $table->string('public_slug')->nullable()->unique();
            $table->timestamps();

            $table->index(['organization_id', 'status']);
            $table->index(['start_date', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workshops');
    }
};
