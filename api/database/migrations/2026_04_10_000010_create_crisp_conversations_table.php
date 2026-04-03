<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crisp_conversations', function (Blueprint $table) {
            $table->id();
            $table->string('crisp_session_id', 255)->unique();
            // Matched by email from Crisp contact metadata — nullable if unresolved
            $table->foreignId('organization_id')->nullable()->constrained('organizations')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['pending', 'ongoing', 'resolved', 'unresolved']);
            $table->string('subject', 500)->nullable();
            $table->dateTime('first_message_at');
            $table->dateTime('last_message_at')->nullable();
            $table->dateTime('first_reply_at')->nullable();
            $table->dateTime('resolved_at')->nullable();
            // Crisp agent name — not a local user
            $table->string('assigned_to', 255)->nullable();
            $table->json('tags_json')->nullable();
            $table->unsignedInteger('message_count')->default(0);
            $table->timestamps();

            $table->index('organization_id');
            $table->index('user_id');
            $table->index('status');
            $table->index('last_message_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crisp_conversations');
    }
};
