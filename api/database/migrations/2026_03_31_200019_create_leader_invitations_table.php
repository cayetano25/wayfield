<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leader_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workshop_id')->nullable()->constrained('workshops')->nullOnDelete();
            // leader_id is null until the invitation is accepted and the leader record is linked
            $table->foreignId('leader_id')->nullable()->constrained('leaders')->nullOnDelete();
            $table->string('invited_email');
            $table->string('invited_first_name', 100)->nullable();
            $table->string('invited_last_name', 100)->nullable();
            $table->enum('status', ['pending', 'accepted', 'declined', 'expired', 'removed'])->default('pending');
            // Raw token is sent in the email link ONLY — stored as hash here
            $table->string('invitation_token_hash');
            $table->dateTime('expires_at');
            $table->dateTime('responded_at')->nullable();
            $table->foreignId('created_by_user_id')->constrained('users');
            $table->timestamps();

            $table->index(['organization_id', 'status']);
            $table->index('workshop_id');
            $table->index('invited_email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leader_invitations');
    }
};
