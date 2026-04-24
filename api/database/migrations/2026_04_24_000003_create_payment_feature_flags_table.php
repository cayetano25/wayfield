<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_feature_flags', function (Blueprint $table) {
            $table->id();
            $table->enum('scope', ['platform', 'organization'])->notNull();
            $table->foreignId('organization_id')
                ->nullable()
                ->constrained('organizations')
                ->cascadeOnDelete();
            $table->string('flag_key', 100)->notNull();
            $table->boolean('is_enabled')->notNull()->default(false);
            $table->dateTime('enabled_at')->nullable();
            $table->foreignId('enabled_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->text('notes')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            // NOTE: MySQL treats NULLs as distinct in UNIQUE indexes, so for
            // platform-scope rows (organization_id = NULL), application code
            // enforces uniqueness via updateOrInsert in seeders/actions.
            $table->unique(['scope', 'organization_id', 'flag_key'], 'pff_scope_org_flag_unique');
            $table->index(['scope', 'flag_key', 'is_enabled'], 'pff_scope_flag_enabled_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_feature_flags');
    }
};
