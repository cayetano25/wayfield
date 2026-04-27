<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('notification_id')
                ->nullable()
                ->constrained('notifications')
                ->nullOnDelete();
            $table->foreignId('recipient_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->string('recipient_email', 255)->notNull();
            $table->string('notification_code', 10)->notNull();
            $table->string('subject', 500)->notNull();
            $table->string('template_name', 100)->notNull();
            $table->string('provider', 20)->notNull()->default('ses');
            $table->string('provider_message_id', 255)->nullable();
            $table->enum('status', ['queued', 'sent', 'delivered', 'bounced', 'complained', 'failed'])
                ->notNull()
                ->default('queued');
            $table->dateTime('sent_at')->nullable();
            $table->dateTime('delivered_at')->nullable();
            $table->dateTime('opened_at')->nullable();
            $table->dateTime('clicked_at')->nullable();
            $table->text('error_message')->nullable();
            $table->string('related_entity_type', 100)->nullable();
            $table->unsignedBigInteger('related_entity_id')->nullable();
            $table->json('metadata_json')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index(['recipient_user_id', 'status']);
            $table->index(['notification_code', 'created_at']);
            $table->index('provider_message_id');
            $table->index(['status', 'created_at']);
            $table->index(['related_entity_type', 'related_entity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_logs');
    }
};
