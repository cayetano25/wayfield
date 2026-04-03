<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')
                ->constrained('organizations')
                ->cascadeOnDelete();

            // Human-readable label, e.g. "Integration with Zapier"
            $table->string('name', 255)->notNull();

            // First 10 characters of the full key for safe display.
            // Full format: wf_live_{48 random chars} or wf_test_{48 random chars}
            $table->string('key_prefix', 10)->notNull();

            // SHA256 hash of the full key — the raw key is never stored after creation.
            // On authentication: SHA256(incoming_key) is compared to this column.
            $table->string('key_hash', 255)->unique()->notNull();

            // Array of allowed scope strings.
            // Valid values: workshops:read, sessions:read, leaders:read, participants:read
            $table->json('scopes')->notNull();

            $table->boolean('is_active')->default(true)->notNull();
            $table->dateTime('last_used_at')->nullable();
            $table->dateTime('expires_at')->nullable();

            $table->foreignId('created_by_user_id')
                ->constrained('users');

            $table->dateTime('created_at');
            $table->dateTime('updated_at');

            $table->index('organization_id');
            $table->index('key_hash');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_keys');
    }
};
