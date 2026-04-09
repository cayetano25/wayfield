<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Attendance\Actions\OrganizerRemoveParticipantFromSessionAction;
use App\Domain\Shared\Services\AuditLogService;
use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
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
     * POST /api/v1/workshops/{workshop}/sessions/{session}/participants
     *
     * Organizer adds a registered participant to a session.
     * Creates or re-activates a session selection and ensures an attendance record exists.
     */
    public function add(
        Request $request,
        Workshop $workshop,
        Session $session,
    ): JsonResponse {
        $actor = $request->user();

        $membership = OrganizationUser::where('organization_id', $workshop->organization_id)
            ->where('user_id', $actor->id)
            ->where('is_active', true)
            ->first();

        if (! $membership) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (! in_array($membership->role, ['owner', 'admin', 'staff'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($session->workshop_id !== $workshop->id) {
            return response()->json(['message' => 'Session not found in this workshop.'], 404);
        }

        $request->validate(['user_id' => 'required|integer|exists:users,id']);

        $participant = User::findOrFail($request->integer('user_id'));

        $registration = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $participant->id)
            ->where('registration_status', 'registered')
            ->first();

        if (! $registration) {
            return response()->json([
                'message' => 'This user is not registered for this workshop.',
                'errors' => ['user_id' => ['User must be registered for the workshop first.']],
            ], 422);
        }

        if ($session->capacity !== null) {
            $enrolled = SessionSelection::where('session_id', $session->id)
                ->where('selection_status', 'selected')
                ->count();
            if ($enrolled >= $session->capacity) {
                return response()->json([
                    'message' => 'This session is at full capacity.',
                    'errors' => ['session' => ['Session is full.']],
                ], 422);
            }
        }

        $existing = SessionSelection::where('registration_id', $registration->id)
            ->where('session_id', $session->id)
            ->first();

        if ($existing) {
            if ($existing->selection_status === 'selected') {
                return response()->json([
                    'message' => 'This participant is already in this session.',
                ], 422);
            }
            $existing->update(['selection_status' => 'selected']);
            $selectionId = $existing->id;
        } else {
            $selection = SessionSelection::create([
                'registration_id' => $registration->id,
                'session_id' => $session->id,
                'selection_status' => 'selected',
            ]);
            $selectionId = $selection->id;
        }

        AttendanceRecord::firstOrCreate(
            ['session_id' => $session->id, 'user_id' => $participant->id],
            ['status' => 'not_checked_in'],
        );

        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id' => $actor->id,
            'entity_type' => 'session_selection',
            'entity_id' => $selectionId,
            'action' => 'organizer_added_participant_to_session',
            'metadata' => [
                'session_id' => $session->id,
                'session_title' => $session->title,
                'participant_id' => $participant->id,
                'participant_first_name' => $participant->first_name,
                'participant_last_name' => $participant->last_name,
            ],
        ]);

        return response()->json([
            'message' => $participant->first_name.' '.$participant->last_name
                .' added to '.$session->title.'.',
        ]);
    }

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
