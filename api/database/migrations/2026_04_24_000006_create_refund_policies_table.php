<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refund_policies', function (Blueprint $table) {
            $table->id();
            $table->enum('scope', ['platform', 'organization', 'workshop'])->notNull();
            $table->foreignId('organization_id')
                ->nullable()
                ->constrained('organizations')
                ->cascadeOnDelete();
            $table->foreignId('workshop_id')
                ->nullable()
                ->constrained('workshops')
                ->cascadeOnDelete();
            $table->integer('full_refund_cutoff_days')->notNull()->default(14);
            $table->integer('partial_refund_cutoff_days')->notNull()->default(7);
            $table->decimal('partial_refund_pct', 5, 2)->notNull()->default(50.00);
            $table->integer('no_refund_cutoff_hours')->notNull()->default(48);
            $table->boolean('wayfield_fee_refundable')->notNull()->default(false);
            $table->boolean('stripe_fee_refundable')->notNull()->default(false);
            $table->boolean('allow_credits')->notNull()->default(false);
            $table->integer('credit_expiry_days')->nullable()->default(365);
            $table->text('custom_policy_text')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            // MySQL NULL uniqueness caveat: app layer enforces one platform-scope record.
            $table->unique(['scope', 'organization_id', 'workshop_id'], 'rp_scope_org_workshop_unique');
            $table->index('scope');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refund_policies');
    }
};
