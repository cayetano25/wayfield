<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * SSO Controller — Phase 9 Stubs.
 *
 * These endpoints are reserved for future SAML/OIDC authentication flows.
 * They return 501 Not Implemented until the SSO activation phase is built.
 *
 * Route shape:
 *   GET  /api/v1/sso/{organization:slug}/login      → initiates IdP redirect
 *   POST /api/v1/sso/{organization:slug}/callback   → receives IdP response
 */
class SsoController extends Controller
{
    /**
     * GET /api/v1/sso/{organization:slug}/login
     *
     * Future: builds SAML AuthnRequest or OIDC authorization URL and redirects
     * the user to the Identity Provider.
     */
    public function login(): JsonResponse
    {
        return response()->json([
            'error' => 'sso_not_active',
            'stub' => true,
        ], 501);
    }

    /**
     * POST /api/v1/sso/{organization:slug}/callback
     *
     * Future: receives the IdP POST-back (SAML response or OIDC code),
     * validates it, resolves the user, and issues a Sanctum token.
     */
    public function callback(): JsonResponse
    {
        return response()->json([
            'error' => 'sso_not_active',
            'stub' => true,
        ], 501);
    }
}
