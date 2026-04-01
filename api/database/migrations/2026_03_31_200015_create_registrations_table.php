<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('registrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workshop_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('registration_status', ['registered', 'canceled', 'waitlisted'])
                  ->default('registered');
            $table->string('joined_via_code', 100)->nullable();
            $table->dateTime('registered_at');
            $table->dateTime('canceled_at')->nullable();
            $table->timestamps();

            $table->unique(['workshop_id', 'user_id']);
            $table->index('user_id');
            $table->index(['workshop_id', 'registration_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registrations');
    }
};
