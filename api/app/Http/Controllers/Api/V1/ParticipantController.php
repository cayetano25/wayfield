<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Registration;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ParticipantController extends Controller
{
    /**
     * GET /api/v1/workshops/{workshop}/participants
     *
     * Returns all registered participants for a workshop.
     * Accessible to org owner, admin, and staff.
     * Phone numbers are included only for owner, admin, and staff.
     */
    public function index(Request $request, Workshop $workshop): JsonResponse
    {
        $this->authorize('viewParticipants', $workshop);

        $orgUser = $request->user()->organizationUsers()
            ->where('organization_id', $workshop->organization_id)
            ->where('is_active', true)
            ->first();

        $showPhone = in_array($orgUser?->role, ['owner', 'admin', 'staff']);

        $participants = Registration::where('workshop_id', $workshop->id)
            ->where('registration_status', 'registered')
            ->with(['user', 'selections.session'])
            ->get()
            ->map(function (Registration $registration) use ($showPhone) {
                $user = $registration->user;

                $selectedSessions = $registration->selections
                    ->where('selection_status', 'selected')
                    ->map(fn ($s) => [
                        'id'       => $s->session->id,
                        'title'    => $s->session->title,
                        'start_at' => $s->session->start_at,
                    ])
                    ->values();

                $data = [
                    'id'                  => $user->id,
                    'registration_id'     => $registration->id,
                    'first_name'          => $user->first_name,
                    'last_name'           => $user->last_name,
                    'email'               => $user->email,
                    'registration_status' => $registration->registration_status,
                    'registered_at'       => $registration->registered_at,
                    'sessions_count'      => $selectedSessions->count(),
                    'selected_sessions'   => $selectedSessions,
                ];

                if ($showPhone) {
                    $data['phone_number'] = $user->phone_number;
                }

                return $data;
            });

        return response()->json($participants);
    }
}
