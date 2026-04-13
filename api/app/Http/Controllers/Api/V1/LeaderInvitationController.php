<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Leaders\Actions\AcceptLeaderInvitationAction;
use App\Domain\Leaders\Actions\DeclineLeaderInvitationAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AcceptLeaderInvitationRequest;
use App\Http\Resources\LeaderInvitationResource;
use App\Models\LeaderInvitation;
use Illuminate\Http\JsonResponse;

class LeaderInvitationController extends Controller
{
    /**
     * GET /api/v1/leader-invitations/{token}
     * Resolve an invitation for display on the acceptance screen.
     * Public-but-tokenized — no authentication required.
     *
     * Always returns 200 when the token is valid.
     * The response includes `is_expired` and `status` so the frontend can
     * render the appropriate state (actionable / expired / already responded).
     */
    public function show(string $token): JsonResponse
    {
        $invitation = $this->resolveInvitation($token);

        if (! $invitation) {
            return response()->json(['error' => 'invitation_not_found'], 404);
        }

        return response()->json(
            new LeaderInvitationResource(
                $invitation->load(['organization', 'workshop.defaultLocation'])
            )
        );
    }

    /**
     * POST /api/v1/leader-invitations/{token}/accept
     * Accept the invitation. Requires authenticated user (auth:sanctum).
     * The frontend handles registration or login FIRST, then calls this endpoint.
     *
     * The authenticated user's email must match the invitation's invited_email.
     */
    public function accept(
        AcceptLeaderInvitationRequest $request,
        string $token,
        AcceptLeaderInvitationAction $action,
    ): JsonResponse {
        $invitation = $this->resolveInvitation($token);

        if (! $invitation) {
            return response()->json(['error' => 'invitation_not_found'], 404);
        }

        if (! $invitation->isActionable()) {
            return response()->json([
                'message' => 'This invitation is no longer actionable.',
                'status' => $invitation->status,
            ], 422);
        }

        // Verify the authenticated user's email matches the invited address.
        // Case-insensitive comparison — email addresses are case-insensitive.
        if (strtolower($request->user()->email) !== strtolower($invitation->invited_email)) {
            return response()->json([
                'error' => 'email_mismatch',
                'message' => 'This invitation was sent to a different email address.',
            ], 403);
        }

        $leader = $action->execute(
            $invitation,
            $request->user(),
            $request->validated(),
        );

        return response()->json([
            'message' => 'Invitation accepted.',
            'leader' => [
                'id' => $leader->id,
                'first_name' => $leader->first_name,
                'last_name' => $leader->last_name,
            ],
            'redirect' => '/leader/dashboard',
        ]);
    }

    /**
     * POST /api/v1/leader-invitations/{token}/decline
     * Decline the invitation. No authentication required.
     *
     * Expired invitations may still be declined — the person may want to
     * formally close the loop even after the token expires.
     * Only invitations that have already been accepted, declined, or removed
     * are blocked.
     */
    public function decline(string $token, DeclineLeaderInvitationAction $action): JsonResponse
    {
        $invitation = $this->resolveInvitation($token);

        if (! $invitation) {
            return response()->json(['error' => 'invitation_not_found'], 404);
        }

        // Block if already responded or removed. Allow if pending (including time-expired).
        if (in_array($invitation->status, ['accepted', 'declined', 'removed'], true)) {
            return response()->json([
                'message' => 'This invitation is no longer actionable.',
                'status' => $invitation->status,
            ], 422);
        }

        $actor = auth('sanctum')->user();
        $action->execute($invitation, $actor);

        $invitation->loadMissing(['organization', 'workshop']);

        return response()->json([
            'message' => 'Invitation declined.',
            'organization_name' => $invitation->organization?->name,
            'workshop_title' => $invitation->workshop?->title,
        ]);
    }

    /**
     * Resolve a leader invitation by raw token only.
     *
     * Security pattern:
     *   Hash the incoming raw token with SHA-256, then look up by that hash.
     *   The `invitation_token_hash` column is indexed, so this is an O(log n)
     *   indexed lookup — no timing oracle risk since we're doing an exact hash match,
     *   not a substring or partial comparison.
     *
     *   SHA-256 is preimage-resistant: knowing the hash does not help an attacker
     *   recover the raw token. The raw token is never stored — only the hash is.
     */
    private function resolveInvitation(string $rawToken): ?LeaderInvitation
    {
        $hash = hash('sha256', $rawToken);

        return LeaderInvitation::where('invitation_token_hash', $hash)->first();
    }
}
