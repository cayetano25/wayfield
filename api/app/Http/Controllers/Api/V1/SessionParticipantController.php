<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Attendance\Actions\OrganizerRemoveParticipantFromSessionAction;
use App\Http\Controllers\Controller;
use App\Models\OrganizationUser;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SessionParticipantController extends Controller
{
    public function __construct(
        private readonly OrganizerRemoveParticipantFromSessionAction $removeAction,
    ) {}

    /**
     * DELETE /api/v1/workshops/{workshop}/sessions/{session}/participants/{user}
     *
     * Organizer removes a specific participant from a specific session.
     * Cancels their session selection and resets attendance if checked in.
     * Does not cancel the workshop registration.
     */
    public function removeParticipant(
        Request $request,
        Workshop $workshop,
        Session $session,
        User $user,
    ): JsonResponse {
        $actor = $request->user();

        // a) Verify actor is an active member of the workshop's organization.
        $membership = OrganizationUser::where('organization_id', $workshop->organization_id)
            ->where('user_id', $actor->id)
            ->where('is_active', true)
            ->first();

        if (! $membership) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        // b) Verify role is owner, admin, or staff. Leaders and billing_admin are excluded.
        if (! in_array($membership->role, ['owner', 'admin', 'staff'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        // c) Verify the session belongs to this workshop.
        if ($session->workshop_id !== $workshop->id) {
            return response()->json(['message' => 'Session not found in this workshop.'], 404);
        }

        try {
            $this->removeAction->execute($actor, $workshop, $session, $user);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['message' => 'Participant removed from session successfully.']);
    }
}
