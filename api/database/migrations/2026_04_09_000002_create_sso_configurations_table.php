<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sso_configurations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')
                ->unique()
                ->constrained('organizations')
                ->cascadeOnDelete();
            $table->enum('provider_type', ['saml', 'oidc'])->notNull();
            $table->boolean('is_enabled')->default(false)->notNull();

            // SAML entity ID or OIDC client ID
            $table->string('entity_id', 500)->nullable();

            // SAML SSO endpoint URL or OIDC authorization URL
            $table->string('sso_url', 1000)->nullable();

            // SAML signing certificate (PEM format)
            $table->text('certificate')->nullable();

            // OIDC client secret, encrypted at rest using Laravel's encrypt()
            $table->text('client_secret_enc')->nullable();

            // Maps IdP attribute names to Wayfield field names.
            // Example: {"email":"emailAddress","first_name":"givenName","last_name":"familyName"}
            $table->json('attribute_mapping')->nullable();

            // Array of email domains permitted to authenticate via SSO.
            // Example: ["acme.com","acme.org"]
            // Requests from domains not in this list are rejected.
            $table->json('allowed_domains')->nullable();

            $table->dateTime('created_at');
            $table->dateTime('updated_at');

            $table->index('organization_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sso_configurations');
    }
};
