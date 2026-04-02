<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offline_sync_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workshop_id')->constrained('workshops')->cascadeOnDelete();
            $table->string('version_hash');
            $table->dateTime('generated_at');
            $table->dateTime('created_at');

            $table->index(['workshop_id', 'generated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offline_sync_snapshots');
    }
};
