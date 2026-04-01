<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workshop_leaders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workshop_id')->constrained()->cascadeOnDelete();
            $table->foreignId('leader_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invitation_id')->nullable()->constrained('leader_invitations')->nullOnDelete();
            // Controls public listing on workshop page only — does NOT grant operational access
            $table->boolean('is_confirmed')->default(false);
            $table->timestamps();

            $table->unique(['workshop_id', 'leader_id']);
            $table->index(['leader_id', 'is_confirmed']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workshop_leaders');
    }
};
