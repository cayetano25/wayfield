<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leaders', function (Blueprint $table) {
            $table->string('slug', 255)->nullable()->unique()->after('display_name');
        });
    }

    public function down(): void
    {
        Schema::table('leaders', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn('slug');
        });
    }
};
