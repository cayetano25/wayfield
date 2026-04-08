<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\User;
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
                    'user_id'             => $user->id,
                    'registration_id'     => $registration->id,
                    'first_name'          => $user->first_name,
                    'last_name'           => $user->last_name,
                    'email'               => $user->email,
                    'registration_status' => $registration->registration_status,
                    'registered_at'       => $registration->registered_at,
                    'sessions_count'      => $selectedSessions->count(),
                    'sessions'            => $selectedSessions,
                ];

                if ($showPhone) {
                    $data['phone_number'] = $user->phone_number;
                }

                return $data;
            });

        return response()->json($participants);
    }

    /**
     * GET /api/v1/organizations/{organization}/participants/search?email=alex
     *
     * Search for participants registered to any workshop in this organization.
     * Matches on partial email (LIKE %email%). Returns up to 10 results.
     * Accessible to org owner, admin, and staff.
     */
    public function search(Request $request, Organization $organization): JsonResponse
    {
        $actor = $request->user();

        $membership = OrganizationUser::where('organization_id', $organization->id)
            ->where('user_id', $actor->id)
            ->where('is_active', true)
            ->first();

        if (! $membership) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (! in_array($membership->role, ['owner', 'admin', 'staff'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $request->validate(['email' => 'required|string|min:1|max:255']);

        $emailTerm = $request->string('email');

        $workshopIds = Workshop::where('organization_id', $organization->id)
            ->pluck('id');

        $results = User::whereIn('id', function ($query) use ($workshopIds) {
                $query->select('user_id')
                    ->from('registrations')
                    ->whereIn('workshop_id', $workshopIds)
                    ->where('registration_status', 'registered');
            })
            ->where('email', 'like', '%' . $emailTerm . '%')
            ->select('id', 'first_name', 'last_name', 'email')
            ->limit(10)
            ->get()
            ->map(fn (User $u) => [
                'user_id'    => $u->id,
                'first_name' => $u->first_name,
                'last_name'  => $u->last_name,
                'email'      => $u->email,
            ]);

        return response()->json($results);
    }
}
