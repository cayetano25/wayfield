<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workshop_id')->constrained()->cascadeOnDelete();
            $table->foreignId('track_id')->nullable()->constrained('tracks')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->foreignId('location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->integer('capacity')->nullable();
            $table->enum('delivery_type', ['in_person', 'virtual', 'hybrid'])->default('in_person');
            // Hybrid open issue resolution: virtual_participation_allowed determines
            // whether meeting_url is required for hybrid sessions before publishing.
            // When delivery_type='hybrid' and virtual_participation_allowed=true,
            // meeting_url is required. When false, hybrid is treated as in-person only.
            $table->boolean('virtual_participation_allowed')->default(false);
            $table->string('meeting_platform', 100)->nullable();
            $table->string('meeting_url', 1000)->nullable();
            $table->text('meeting_instructions')->nullable();
            $table->string('meeting_id')->nullable();
            $table->string('meeting_passcode')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_published')->default(false);
            $table->timestamps();

            $table->index(['workshop_id', 'start_at', 'end_at']);
            $table->index('track_id');
            $table->index('location_id');
            $table->index('is_published');
            $table->index('delivery_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
    }
};
