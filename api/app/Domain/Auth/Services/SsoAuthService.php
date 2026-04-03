<?php

namespace App\Domain\Auth\Services;

use App\Exceptions\NotImplementedException;
use App\Models\Organization;
use App\Models\SsoConfiguration;
use App\Models\User;

/**
 * SSO Authentication Service — Phase 9 Stub.
 *
 * This service defines the contract for SAML/OIDC authentication flows.
 * All methods throw NotImplementedException until a future activation phase
 * wires in a real SAML/OIDC library (e.g. onelogin/php-saml or League\OAuth2).
 *
 * Critical implementation constraints (for the future implementor):
 * - Core email/password login MUST NOT be affected by SSO activation.
 * - SSO is additive: it creates an auth_methods row with provider = 'saml' or 'oidc'
 *   and links to an existing or new User record.
 * - A user resolved via SSO MUST have first_name AND last_name — never create a
 *   user account without both. Throw SsoMissingAttributeException if they cannot
 *   be resolved from the IdP attributes via attribute_mapping.
 * - The allowed_domains list on sso_configurations gates which email domains
 *   may authenticate via SSO for that organization.
 */
class SsoAuthService
{
    /**
     * Initiate an SSO login flow for the given organization.
     *
     * Returns a redirect URL to the Identity Provider (IdP).
     *
     * In production (SAML): builds a signed AuthnRequest and returns the
     * IdP's SSO URL with the encoded request appended.
     *
     * In production (OIDC): constructs the authorization URL using the
     * entity_id (client_id), sso_url (authorization endpoint), and required
     * scopes (openid, email, profile).
     *
     * @param Organization $org       The organization initiating the SSO login.
     * @param string       $returnUrl The Wayfield URL to redirect back to after auth.
     *
     * @return string The IdP redirect URL.
     *
     * @throws NotImplementedException Always — SSO not yet active.
     */
    public function initiateLogin(Organization $org, string $returnUrl): string
    {
        throw new NotImplementedException('SSO authentication is not yet active.');
    }

    /**
     * Handle the IdP callback after authentication.
     *
     * For SAML: validates the SAMLResponse POST parameter, verifies the
     * certificate signature against sso_configurations.certificate, and
     * extracts attributes using attribute_mapping.
     *
     * For OIDC: exchanges the authorization code for tokens using the
     * client_id (entity_id) and decrypted client_secret_enc, then fetches
     * the userinfo endpoint to extract claims.
     *
     * After attribute extraction, delegates to resolveOrCreateUser().
     *
     * @param Organization $org          The organization that owns this SSO config.
     * @param array        $callbackData Raw callback data (POST params or query string).
     *
     * @return User The authenticated and resolved Wayfield user.
     *
     * @throws NotImplementedException Always — SSO not yet active.
     */
    public function handleCallback(Organization $org, array $callbackData): User
    {
        throw new NotImplementedException('SSO authentication is not yet active.');
    }

    /**
     * Resolve an SSO-authenticated identity to a Wayfield user.
     *
     * Resolution logic:
     * 1. Extract email, first_name, last_name from $idpAttributes using
     *    the organization's attribute_mapping configuration.
     * 2. If email domain is not in sso_configurations.allowed_domains,
     *    throw SsoEmailDomainNotAllowedException.
     * 3. If first_name or last_name cannot be resolved, throw
     *    SsoMissingAttributeException. NEVER create a user without both names.
     * 4. If a User with this email already exists, create or update an
     *    auth_methods row (provider = 'saml'|'oidc', provider_user_id from IdP).
     * 5. If no user exists, create a new User with first_name, last_name, email,
     *    and a locked password (random unguessable string — SSO users cannot
     *    use password login unless they later set one via password reset).
     * 6. Return the resolved User.
     *
     * @param Organization $org           The organization context.
     * @param array        $idpAttributes Raw attribute bag from the IdP response.
     *
     * @return User The resolved or newly created user.
     *
     * @throws NotImplementedException Always — SSO not yet active.
     */
    public function resolveOrCreateUser(Organization $org, array $idpAttributes): User
    {
        throw new NotImplementedException('SSO authentication is not yet active.');
    }

    /**
     * Check if an organization has SSO enabled.
     *
     * @param Organization $org
     *
     * @return bool True if an active, enabled sso_configurations row exists.
     */
    public function isEnabledForOrganization(Organization $org): bool
    {
        return SsoConfiguration::where('organization_id', $org->id)
            ->where('is_enabled', true)
            ->exists();
    }

    /**
     * Get the SSO configuration for an organization.
     *
     * @param Organization $org
     *
     * @return SsoConfiguration|null Null if not configured.
     */
    public function getConfiguration(Organization $org): ?SsoConfiguration
    {
        return SsoConfiguration::where('organization_id', $org->id)->first();
    }
}
