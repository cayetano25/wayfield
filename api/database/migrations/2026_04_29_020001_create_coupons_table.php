<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')
                ->constrained('organizations')
                ->cascadeOnDelete();
            $table->foreignId('workshop_id')
                ->nullable()
                ->constrained('workshops')
                ->cascadeOnDelete();
            $table->foreignId('created_by_user_id')
                ->constrained('users');
            $table->string('code', 50)->notNull();
            $table->string('label')->notNull();
            $table->text('description')->nullable();
            $table->enum('discount_type', ['percentage', 'fixed_amount', 'free'])->notNull();
            $table->decimal('discount_pct', 5, 2)->nullable();
            $table->unsignedInteger('discount_amount_cents')->nullable();
            $table->enum('applies_to', ['all', 'workshop_only', 'addons_only'])->notNull()->default('all');
            $table->unsignedInteger('minimum_order_cents')->notNull()->default(0);
            $table->unsignedInteger('max_redemptions')->nullable();
            $table->unsignedInteger('max_redemptions_per_user')->notNull()->default(1);
            $table->boolean('is_active')->notNull()->default(true);
            $table->dateTime('valid_from')->nullable();
            $table->dateTime('valid_until')->nullable();
            $table->unsignedInteger('redemption_count')->notNull()->default(0);
            $table->unsignedBigInteger('total_discount_given_cents')->notNull()->default(0);
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            // Code must be unique per org; two orgs may share the same code string.
            $table->unique(['organization_id', 'code'], 'coupons_org_code_unique');
            $table->index(['organization_id', 'is_active'], 'coupons_org_active_index');
            // workshop_id is already indexed by its FK constraint.
            $table->index('discount_type');
            $table->index(['valid_until', 'is_active'], 'coupons_valid_until_active_index');
            $table->index('code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coupons');
    }
};
