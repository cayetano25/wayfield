<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 2FA Auth Hardening — Phase 6 Scaffolding
 *
 * The schema (user_2fa_methods + user_2fa_recovery_codes) was created in Phase 1.
 * This controller provides the endpoint structure for a future Phase activation.
 *
 * All endpoints return 501 Not Implemented until 2FA activation is built.
 * No schema changes are required to activate these routes in a future phase.
 *
 * Activation path (Phase 9 or standalone):
 * 1. Implement App\Domain\Auth\Actions\EnableTwoFactorAction
 * 2. Implement App\Domain\Auth\Actions\VerifyTwoFactorChallengeAction
 * 3. Implement App\Domain\Auth\Actions\DisableTwoFactorAction
 * 4. Replace the 501 stubs below with real logic
 * 5. Add 'two_factor_verified' middleware to sensitive routes as needed
 */
class TwoFactorController extends Controller
{
    /**
     * GET /api/v1/auth/2fa/status
     *
     * Return whether 2FA is enrolled for the authenticated user.
     * Scaffolding only — not yet activated.
     */
    public function status(Request $request): JsonResponse
    {
        return response()->json([
            'message' => '2FA status endpoint is scaffolded but not yet activated.',
            'enrolled' => false,
        ], 501);
    }

    /**
     * POST /api/v1/auth/2fa/enable
     *
     * Begin TOTP enrollment for the authenticated user.
     * Scaffolding only — not yet activated.
     *
     * Expected request body:
     * - method_type: 'totp' | 'email_code'
     */
    public function enable(Request $request): JsonResponse
    {
        return response()->json([
            'message' => '2FA enrollment is scaffolded but not yet activated.',
        ], 501);
    }

    /**
     * POST /api/v1/auth/2fa/confirm
     *
     * Confirm TOTP enrollment by verifying the first code.
     * Scaffolding only — not yet activated.
     *
     * Expected request body:
     * - code: 6-digit TOTP code
     */
    public function confirm(Request $request): JsonResponse
    {
        return response()->json([
            'message' => '2FA confirmation is scaffolded but not yet activated.',
        ], 501);
    }

    /**
     * POST /api/v1/auth/2fa/challenge
     *
     * Verify a 2FA challenge during login.
     * Scaffolding only — not yet activated.
     *
     * Expected request body:
     * - code: 6-digit TOTP code or email OTP
     */
    public function challenge(Request $request): JsonResponse
    {
        return response()->json([
            'message' => '2FA challenge verification is scaffolded but not yet activated.',
        ], 501);
    }

    /**
     * POST /api/v1/auth/2fa/disable
     *
     * Disable 2FA for the authenticated user.
     * Scaffolding only — not yet activated.
     *
     * Expected request body:
     * - code: current TOTP code (for confirmation)
     */
    public function disable(Request $request): JsonResponse
    {
        return response()->json([
            'message' => '2FA disable is scaffolded but not yet activated.',
        ], 501);
    }

    /**
     * GET /api/v1/auth/2fa/recovery-codes
     *
     * Return remaining recovery codes for the authenticated user.
     * Scaffolding only — not yet activated.
     */
    public function recoveryCodes(Request $request): JsonResponse
    {
        return response()->json([
            'message' => '2FA recovery codes are scaffolded but not yet activated.',
        ], 501);
    }
}
