<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_sequences', function (Blueprint $table) {
            $table->unsignedSmallInteger('year')->primary();
            $table->unsignedInteger('next_value')->notNull()->default(1);
        });

        // Seed with the current year so the first order immediately works.
        DB::table('order_sequences')->insert([
            'year'       => (int) date('Y'),
            'next_value' => 1,
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('order_sequences');
    }
};
