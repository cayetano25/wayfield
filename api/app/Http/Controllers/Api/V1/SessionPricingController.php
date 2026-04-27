<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Models\SessionPricing;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreSessionPricingRequest;
use App\Http\Resources\SessionPricingResource;
use App\Models\Session;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SessionPricingController extends Controller
{
    /**
     * GET /api/v1/sessions/{session}/pricing
     * Allowed: owner, admin
     */
    public function show(Request $request, Session $session): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $session);

        $pricing = SessionPricing::where('session_id', $session->id)->first();

        if ($pricing === null) {
            return response()->json(['data' => null], 200);
        }

        return response()->json(['data' => new SessionPricingResource($pricing)]);
    }

    /**
     * POST /api/v1/sessions/{session}/pricing
     * Allowed: owner, admin
     *
     * Session must have session_type IN ('addon','invite_only').
     */
    public function store(StoreSessionPricingRequest $request, Session $session): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $session);

        $existing = SessionPricing::where('session_id', $session->id)->first();

        if ($existing !== null) {
            return response()->json([
                'error'   => 'pricing_exists',
                'message' => 'This session already has pricing configured. Use PUT to update.',
            ], 409);
        }

        $pricing = SessionPricing::create(array_merge(
            $request->validated(),
            ['session_id' => $session->id],
        ));

        return response()->json(['data' => new SessionPricingResource($pricing)], 201);
    }

    /**
     * PUT /api/v1/sessions/{session}/pricing
     * Allowed: owner, admin
     */
    public function update(StoreSessionPricingRequest $request, Session $session): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $session);

        $pricing = SessionPricing::where('session_id', $session->id)->first();

        if ($pricing === null) {
            return response()->json([
                'error'   => 'not_found',
                'message' => 'No pricing found for this session. Use POST to create.',
            ], 404);
        }

        $pricing->update($request->validated());

        return response()->json(['data' => new SessionPricingResource($pricing->fresh())]);
    }

    /**
     * DELETE /api/v1/sessions/{session}/pricing
     * Allowed: owner, admin
     */
    public function destroy(Request $request, Session $session): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $session);

        $pricing = SessionPricing::where('session_id', $session->id)->first();

        if ($pricing === null) {
            return response()->json([
                'error'   => 'not_found',
                'message' => 'No pricing found for this session.',
            ], 404);
        }

        $pricing->delete();

        return response()->json(null, 204);
    }

    // ─────────────────────────────────────────────────────────────────────────

    private function authorizeOwnerOrAdmin(Request $request, Session $session): void
    {
        // Allowed: owner, admin
        // Denied: staff, billing_admin
        $session->loadMissing('workshop.organization');
        $role = $session->workshop->organization->memberRole($request->user());

        if (! in_array($role, ['owner', 'admin'], true)) {
            abort(403, 'Only organization owners and admins may manage session pricing.');
        }
    }
}
