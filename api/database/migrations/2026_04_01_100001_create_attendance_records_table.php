<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('sessions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['not_checked_in', 'checked_in', 'no_show'])->default('not_checked_in');
            $table->enum('check_in_method', ['self', 'leader'])->nullable();
            $table->dateTime('checked_in_at')->nullable();
            $table->foreignId('checked_in_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['session_id', 'user_id']);
            $table->index('user_id');
            $table->index('status');
            $table->index('checked_in_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_records');
    }
};
