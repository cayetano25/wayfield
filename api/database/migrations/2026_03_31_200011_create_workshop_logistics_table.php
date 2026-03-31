<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workshop_logistics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workshop_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('hotel_name')->nullable();
            $table->string('hotel_address')->nullable();
            $table->string('hotel_phone', 50)->nullable();
            $table->text('hotel_notes')->nullable();
            $table->text('parking_details')->nullable();
            $table->text('meeting_room_details')->nullable();
            $table->text('meetup_instructions')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workshop_logistics');
    }
};
