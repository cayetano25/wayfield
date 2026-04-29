<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Models\StripeConnectAccount;
use App\Domain\Payments\Services\PaymentFeatureFlagService;
use App\Domain\Payments\Services\StripeConnectService;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class StripeConnectController extends Controller
{
    public function __construct(
        private readonly StripeConnectService $connectService,
        private readonly PaymentFeatureFlagService $flags,
    ) {}

    /**
     * POST /api/v1/organizations/{organization}/stripe/connect
     * Allowed: owner, admin
     * Denied: staff, billing_admin
     *
     * Initiates Express onboarding for the org. Returns the hosted onboarding URL.
     */
    public function initiate(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $organization);

        if (! $this->flags->isOrgPaymentsEnabled($organization->id)) {
            return response()->json([
                'error' => 'payments_not_enabled',
                'message' => 'Payments have not been enabled for this organization.',
            ], 403);
        }

        $existing = StripeConnectAccount::where('organization_id', $organization->id)->first();

        if ($existing && $existing->onboarding_status !== 'deauthorized') {
            return response()->json([
                'error'   => 'already_connected',
                'message' => 'A Stripe Connect account already exists for this organization.',
                'data'    => [
                    'stripe_account_id' => $existing->stripe_account_id,
                    'onboarding_status' => $existing->onboarding_status,
                ],
            ], 409);
        }

        try {
            $account = $this->connectService->createConnectAccount($organization, $request->user());

            $linkUrl = $this->connectService->createAccountLink(
                $account,
                returnUrl:  $this->buildReturnUrl($organization),
                refreshUrl: $this->buildRefreshUrl($organization),
            );
        } catch (\RuntimeException $e) {
            return $this->handleStripeException($e);
        }

        return response()->json([
            'data' => [
                'stripe_account_id' => $account->stripe_account_id,
                'onboarding_status' => $account->onboarding_status,
                'account_link_url'  => $linkUrl,
            ],
        ], 201);
    }

    /**
     * POST /api/v1/organizations/{organization}/stripe/refresh-link
     * Allowed: owner, admin
     * Denied: staff, billing_admin
     *
     * Generates a fresh onboarding link (the original link expired or onboarding is incomplete).
     */
    public function refreshLink(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $organization);

        $account = StripeConnectAccount::where('organization_id', $organization->id)->first();

        if (! $account) {
            return response()->json([
                'error'   => 'no_connect_account',
                'message' => 'No Stripe Connect account found. Initiate onboarding first.',
            ], 404);
        }

        if ($account->onboarding_status === 'complete') {
            return response()->json([
                'error'   => 'already_complete',
                'message' => 'Onboarding is already complete.',
            ], 422);
        }

        try {
            $linkUrl = $this->connectService->createAccountLink(
                $account,
                returnUrl:  $this->buildReturnUrl($organization),
                refreshUrl: $this->buildRefreshUrl($organization),
            );
        } catch (\RuntimeException $e) {
            return $this->handleStripeException($e);
        }

        return response()->json([
            'data' => [
                'account_link_url' => $linkUrl,
            ],
        ]);
    }

    /**
     * GET /api/v1/organizations/{organization}/stripe/status
     * Allowed: owner, admin, staff
     * Denied: billing_admin
     */
    public function status(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeOperational($request, $organization);

        $account = StripeConnectAccount::where('organization_id', $organization->id)->first();

        return response()->json([
            'data' => [
                'connected'                => $account !== null,
                'charges_enabled'          => (bool) ($account?->charges_enabled),
                'payouts_enabled'          => (bool) ($account?->payouts_enabled),
                'onboarding_status'        => $account?->onboarding_status,
                'details_submitted'        => (bool) ($account?->details_submitted),
                'requirements'             => $account?->requirements_json ?? [],
                'payments_enabled_for_org' => $this->flags->isOrgPaymentsEnabled($organization->id),
            ],
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────

    private function authorizeOwnerOrAdmin(Request $request, Organization $organization): void
    {
        // Allowed: owner, admin
        // Denied: staff, billing_admin
        $role = $organization->memberRole($request->user());

        if (! in_array($role, ['owner', 'admin'], true)) {
            abort(403, 'Only organization owners and admins may manage Stripe Connect.');
        }
    }

    private function authorizeOperational(Request $request, Organization $organization): void
    {
        // Allowed: owner, admin, staff
        // Denied: billing_admin
        $role = $organization->memberRole($request->user());

        if (! in_array($role, ['owner', 'admin', 'staff'], true)) {
            abort(403, 'Insufficient permissions to view payment status.');
        }
    }

    private function buildReturnUrl(Organization $organization): string
    {
        return config('app.frontend_url').'/organization/settings/payments?stripe_return=1';
    }

    private function buildRefreshUrl(Organization $organization): string
    {
        return config('app.url')
            .'/api/v1/organizations/'.$organization->id.'/stripe/refresh-link';
    }

    private function handleStripeException(\RuntimeException $e): JsonResponse
    {
        $code = $e->getCode();

        Log::error('StripeConnectController: Stripe exception', [
            'message' => $e->getMessage(),
            'code'    => $code,
        ]);

        return match ((int) $code) {
            429     => response()->json(['error' => 'rate_limited', 'message' => $e->getMessage()], 429)
                ->header('Retry-After', '60'),
            503     => response()->json(['error' => 'stripe_unavailable', 'message' => $e->getMessage()], 503),
            402     => response()->json(['error' => 'card_error', 'message' => $e->getMessage()], 402),
            422     => response()->json(['error' => 'invalid_request', 'message' => $e->getMessage()], 422),
            default => response()->json(['error' => 'stripe_error', 'message' => 'An error occurred with the payment provider.'], 500),
        };
    }
}
