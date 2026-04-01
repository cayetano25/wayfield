<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Leaders\Actions\AcceptLeaderInvitationAction;
use App\Domain\Leaders\Actions\DeclineLeaderInvitationAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AcceptLeaderInvitationRequest;
use App\Http\Resources\LeaderInvitationResource;
use App\Http\Resources\LeaderSelfProfileResource;
use App\Models\LeaderInvitation;
use Illuminate\Http\JsonResponse;

class LeaderInvitationController extends Controller
{
    /**
     * GET /api/v1/leader-invitations/{id}/{token}
     * Resolve an invitation for display on the acceptance screen.
     * Public-but-tokenized — no authentication required.
     */
    public function show(int $id, string $token): JsonResponse
    {
        $invitation = $this->resolveInvitation($id, $token);

        if (! $invitation) {
            return response()->json(['message' => 'Invitation not found or has expired.'], 404);
        }

        if (! $invitation->isActionable()) {
            return response()->json([
                'message' => 'This invitation is no longer actionable.',
                'status'  => $invitation->status,
            ], 422);
        }

        return response()->json(
            new LeaderInvitationResource($invitation->load(['organization', 'workshop']))
        );
    }

    /**
     * POST /api/v1/leader-invitations/{id}/{token}/accept
     * Accept the invitation. Requires authenticated user.
     * Creates or links the leader profile to the user's account.
     */
    public function accept(
        AcceptLeaderInvitationRequest $request,
        int $id,
        string $token,
        AcceptLeaderInvitationAction $action,
    ): JsonResponse {
        $invitation = $this->resolveInvitation($id, $token);

        if (! $invitation) {
            return response()->json(['message' => 'Invitation not found or has expired.'], 404);
        }

        if (! $invitation->isActionable()) {
            return response()->json([
                'message' => 'This invitation is no longer actionable.',
                'status'  => $invitation->status,
            ], 422);
        }

        $leader = $action->execute(
            $invitation,
            $request->user(),
            $request->validated(),
        );

        return response()->json(new LeaderSelfProfileResource($leader));
    }

    /**
     * POST /api/v1/leader-invitations/{id}/{token}/decline
     * Decline the invitation. No authentication required.
     */
    public function decline(int $id, string $token, DeclineLeaderInvitationAction $action): JsonResponse
    {
        $invitation = $this->resolveInvitation($id, $token);

        if (! $invitation) {
            return response()->json(['message' => 'Invitation not found or has expired.'], 404);
        }

        if (! $invitation->isActionable()) {
            return response()->json([
                'message' => 'This invitation is no longer actionable.',
                'status'  => $invitation->status,
            ], 422);
        }

        $actor = auth('sanctum')->user();
        $action->execute($invitation, $actor);

        return response()->json(['message' => 'Invitation declined.']);
    }

    /**
     * Resolve and verify a leader invitation by ID + raw token.
     *
     * Security pattern:
     *   1. Find the invitation by its non-secret numeric ID (cheap indexed lookup).
     *   2. Compare the submitted raw token against the stored hash using hash_equals()
     *      for constant-time comparison — prevents timing side-channel attacks.
     *
     * Never do a DB lookup keyed on the token hash itself; that would expose the hash
     * as a lookup oracle and bypass constant-time comparison.
     */
    private function resolveInvitation(int $id, string $rawToken): ?LeaderInvitation
    {
        $invitation = LeaderInvitation::find($id);

        if (! $invitation) {
            return null;
        }

        // hash_equals() is constant-time — safe against timing attacks.
        if (! hash_equals($invitation->invitation_token_hash, hash('sha256', $rawToken))) {
            return null;
        }

        return $invitation;
    }
}
