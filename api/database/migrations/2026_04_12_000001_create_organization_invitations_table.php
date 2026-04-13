<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_invitations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('organization_id')
                ->constrained('organizations')
                ->cascadeOnDelete();

            $table->string('invited_email', 255);
            $table->string('invited_first_name', 100)->nullable();
            $table->string('invited_last_name', 100)->nullable();

            $table->enum('role', ['owner', 'admin', 'staff', 'billing_admin']);

            $table->enum('status', ['pending', 'accepted', 'declined', 'expired', 'removed'])
                ->default('pending');

            $table->string('invitation_token_hash', 255)
                ->comment('SHA-256 hash of the raw token. Raw token sent in email only.');

            $table->dateTime('expires_at');
            $table->dateTime('responded_at')->nullable();

            $table->foreignId('created_by_user_id')
                ->constrained('users')
                ->restrictOnDelete();

            $table->timestamps();

            $table->index(['organization_id', 'status']);
            $table->index('invited_email');
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_invitations');
    }
};
