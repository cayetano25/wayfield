<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scheduled_payment_jobs', function (Blueprint $table) {
            $table->id();
            $table->enum('job_type', [
                'balance_charge',
                'balance_reminder',
                'commitment_date_reminder',
                'commitment_date_passed',
                'waitlist_window_expiry',
                'waitlist_window_reminder',
                'pre_workshop_7day',
                'pre_workshop_24hour',
                'pre_session_1hour',
                'dispute_evidence_reminder',
                'stripe_onboarding_incomplete_reminder',
                'cart_expiry',
                'minimum_attendance_check',
            ])->notNull();
            $table->string('notification_code', 10)->nullable();
            $table->string('related_entity_type', 100)->notNull();
            $table->unsignedBigInteger('related_entity_id')->notNull();
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->dateTime('scheduled_for')->notNull();
            $table->enum('status', ['pending', 'processing', 'completed', 'cancelled', 'failed'])
                ->notNull()
                ->default('pending');
            $table->unsignedInteger('attempts')->notNull()->default(0);
            $table->unsignedInteger('max_attempts')->notNull()->default(3);
            $table->dateTime('last_attempted_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->dateTime('cancelled_at')->nullable();
            $table->string('cancellation_reason', 255)->nullable();
            $table->text('result_message')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index(['status', 'scheduled_for'], 'spj_status_scheduled_idx');
            $table->index(['related_entity_type', 'related_entity_id'], 'spj_entity_type_id_idx');
            $table->index(['user_id', 'status'], 'spj_user_status_idx');
            $table->index(['job_type', 'status'], 'spj_job_type_status_idx');
            $table->index('scheduled_for', 'spj_scheduled_for_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scheduled_payment_jobs');
    }
};
