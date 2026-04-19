<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workshops', function (Blueprint $table) {
            $table->dateTime('join_code_rotated_at')->nullable()->after('join_code');
            $table->unsignedBigInteger('join_code_rotated_by_user_id')->nullable()->after('join_code_rotated_at');

            $table->foreign('join_code_rotated_by_user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('workshops', function (Blueprint $table) {
            $table->dropForeign(['join_code_rotated_by_user_id']);
            $table->dropColumn(['join_code_rotated_at', 'join_code_rotated_by_user_id']);
        });
    }
};
