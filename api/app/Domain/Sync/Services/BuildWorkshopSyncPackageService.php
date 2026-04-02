<?php

namespace App\Domain\Sync\Services;

use App\Models\Leader;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Build the offline sync package for a workshop.
 *
 * Privacy invariants enforced here:
 *   - meeting_url / meeting_id / meeting_passcode are NEVER included in any package.
 *   - Participant package: no phone numbers, no full roster.
 *   - Leader package: phone numbers ONLY for participants in sessions the requesting
 *     leader is assigned to (scoped via session_leaders, not all sessions).
 *   - Leader array in both packages: public-safe fields only, EXCEPT the requesting
 *     leader's own profile may include private contact fields.
 */
class BuildWorkshopSyncPackageService
{
    /**
     * @param  string  $role    'participant' | 'leader'
     * @param  int     $userId  The authenticated user's ID
     */
    public function build(Workshop $workshop, string $role, int $userId): array
    {
        $workshop->load(['logistics', 'defaultLocation']);

        $package = [
            'version'   => null, // caller injects version hash if desired
            'role'      => $role,
            'workshop'  => $this->serializeWorkshop($workshop),
            'logistics' => $this->serializeLogistics($workshop),
            'sessions'  => $this->serializeSessions($workshop),
            'leaders'   => $this->serializeWorkshopLeaders($workshop, $userId, $role),
        ];

        if ($role === 'participant') {
            $package = array_merge($package, $this->participantExtras($workshop, $userId));
        } elseif ($role === 'leader') {
            $package = array_merge($package, $this->leaderExtras($workshop, $userId));
        }

        return $package;
    }

    // ─── Workshop core (no meeting fields) ───────────────────────────────────────

    private function serializeWorkshop(Workshop $workshop): array
    {
        return [
            'id'            => $workshop->id,
            'title'         => $workshop->title,
            'description'   => $workshop->description,
            'workshop_type' => $workshop->workshop_type,
            'status'        => $workshop->status,
            'timezone'      => $workshop->timezone,
            'start_date'    => $workshop->start_date?->toDateString(),
            'end_date'      => $workshop->end_date?->toDateString(),
            'join_code'     => $workshop->join_code,
            'default_location' => $workshop->defaultLocation ? [
                'id'      => $workshop->defaultLocation->id,
                'name'    => $workshop->defaultLocation->name,
                'address' => $workshop->defaultLocation->address_line_1,
                'city'    => $workshop->defaultLocation->city,
            ] : null,
        ];
    }

    // ─── Logistics ───────────────────────────────────────────────────────────────

    private function serializeLogistics(Workshop $workshop): ?array
    {
        $l = $workshop->logistics;
        if (! $l) {
            return null;
        }

        return [
            'hotel_name'         => $l->hotel_name,
            'hotel_address'      => $l->hotel_address,
            'hotel_phone'        => $l->hotel_phone,
            'hotel_notes'        => $l->hotel_notes,
            'parking_details'    => $l->parking_details,
            'meeting_room'       => $l->meeting_room,
            'meetup_instructions'=> $l->meetup_instructions,
        ];
    }

    // ─── Sessions (ALL privacy fields stripped) ───────────────────────────────────

    private function serializeSessions(Workshop $workshop): array
    {
        $sessions = Session::with(['track', 'location', 'sessionLeaders.leader'])
            ->where('workshop_id', $workshop->id)
            ->where('is_published', true)
            ->get();

        return $sessions->map(function (Session $session) {
            return $this->serializeSession($session);
        })->values()->all();
    }

    private function serializeSession(Session $session): array
    {
        // NEVER include: meeting_url, meeting_id, meeting_passcode
        return [
            'id'            => $session->id,
            'title'         => $session->title,
            'description'   => $session->description,
            'start_at'      => $session->start_at?->toIso8601String(),
            'end_at'        => $session->end_at?->toIso8601String(),
            'delivery_type' => $session->delivery_type,
            'virtual_participation_allowed' => $session->virtual_participation_allowed,
            'meeting_platform' => $session->meeting_platform, // platform name only (e.g. "Zoom") is safe
            'capacity'      => $session->capacity,
            'is_published'  => $session->is_published,
            'notes'         => $session->notes,
            'track'         => $session->track ? [
                'id'   => $session->track->id,
                'name' => $session->track->name,
            ] : null,
            'location'      => $session->location ? [
                'id'      => $session->location->id,
                'name'    => $session->location->name,
                'city'    => $session->location->city,
            ] : null,
            // Leader IDs only — full leader objects in the top-level leaders array
            'leader_ids'    => $session->sessionLeaders->pluck('leader_id')->values()->all(),
        ];
    }

    // ─── Leaders array ────────────────────────────────────────────────────────────

    /**
     * All confirmed workshop leaders, public-safe fields.
     * The requesting leader's own record includes private contact fields.
     */
    private function serializeWorkshopLeaders(Workshop $workshop, int $userId, string $role): array
    {
        $confirmed = Leader::whereHas('workshopLeaders', function ($q) use ($workshop) {
            $q->where('workshop_id', $workshop->id)
              ->where('is_confirmed', true);
        })->get();

        // Resolve the requesting leader record when role = leader
        $requestingLeaderId = null;
        if ($role === 'leader') {
            $requestingLeaderId = Leader::where('user_id', $userId)->value('id');
        }

        return $confirmed->map(function (Leader $leader) use ($requestingLeaderId) {
            $isSelf = $requestingLeaderId && $leader->id === $requestingLeaderId;
            return $this->serializeLeader($leader, includeSelfFields: $isSelf);
        })->values()->all();
    }

    private function serializeLeader(Leader $leader, bool $includeSelfFields = false): array
    {
        // Public-safe fields — NEVER email, phone, address of others
        $data = [
            'id'                => $leader->id,
            'first_name'        => $leader->first_name,
            'last_name'         => $leader->last_name,
            'display_name'      => $leader->display_name,
            'profile_image_url' => $leader->profile_image_url,
            'bio'               => $leader->bio,
            'website_url'       => $leader->website_url,
            'city'              => $leader->city,
            'state_or_region'   => $leader->state_or_region,
        ];

        // The leader viewing their own profile may see their private contact details
        if ($includeSelfFields) {
            $data['email']         = $leader->email;
            $data['phone_number']  = $leader->phone_number;
            $data['address_line_1']= $leader->address_line_1;
            $data['address_line_2']= $leader->address_line_2;
            $data['postal_code']   = $leader->postal_code;
            $data['country']       = $leader->country;
        }

        return $data;
    }

    // ─── Participant extras ───────────────────────────────────────────────────────

    private function participantExtras(Workshop $workshop, int $userId): array
    {
        $registration = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $userId)
            ->first();

        if (! $registration) {
            return ['my_registration' => null, 'my_selections' => []];
        }

        $selections = SessionSelection::where('registration_id', $registration->id)
            ->where('selection_status', 'selected')
            ->pluck('session_id')
            ->values()
            ->all();

        return [
            'my_registration' => [
                'id'                  => $registration->id,
                'registration_status' => $registration->registration_status,
                'registered_at'       => $registration->registered_at?->toIso8601String(),
            ],
            'my_selections' => $selections,
        ];
    }

    // ─── Leader extras ────────────────────────────────────────────────────────────

    private function leaderExtras(Workshop $workshop, int $userId): array
    {
        // Resolve leader record
        $leader = Leader::where('user_id', $userId)->first();

        if (! $leader) {
            return [
                'my_assigned_session_ids' => [],
                'roster'                  => [],
            ];
        }

        // Sessions this leader is explicitly assigned to within this workshop
        $assignedSessionIds = SessionLeader::join('sessions', 'sessions.id', '=', 'session_leaders.session_id')
            ->where('sessions.workshop_id', $workshop->id)
            ->where('session_leaders.leader_id', $leader->id)
            ->where('session_leaders.assignment_status', 'accepted')
            ->pluck('session_leaders.session_id')
            ->values()
            ->all();

        // Build roster ONLY for assigned sessions — per-session, with phone numbers
        $roster = $this->buildLeaderRoster($workshop, $assignedSessionIds);

        return [
            'my_assigned_session_ids' => $assignedSessionIds,
            'roster'                  => $roster,
        ];
    }

    /**
     * Build per-session roster entries including phone numbers.
     * ONLY for the session IDs provided (the leader's assigned sessions).
     *
     * A leader assigned to Session A must NOT receive phone numbers for
     * participants in Session B, even if Session B exists in the same workshop.
     */
    private function buildLeaderRoster(Workshop $workshop, array $sessionIds): array
    {
        if (empty($sessionIds)) {
            return [];
        }

        $roster = [];

        foreach ($sessionIds as $sessionId) {
            // Participants with an active registration in this workshop who have
            // selected this session (session_based) or are simply registered (event_based).
            $participants = DB::table('registrations')
                ->join('users', 'users.id', '=', 'registrations.user_id')
                ->leftJoin('session_selections', function ($join) use ($sessionId) {
                    $join->on('session_selections.registration_id', '=', 'registrations.id')
                         ->where('session_selections.session_id', '=', $sessionId)
                         ->where('session_selections.selection_status', '=', 'selected');
                })
                ->leftJoin('attendance_records', function ($join) use ($sessionId) {
                    $join->on('attendance_records.user_id', '=', 'registrations.user_id')
                         ->where('attendance_records.session_id', '=', $sessionId);
                })
                ->where('registrations.workshop_id', $workshop->id)
                ->where('registrations.registration_status', 'registered')
                ->where(function ($q) use ($workshop, $sessionId) {
                    if ($workshop->isSessionBased()) {
                        // session_based: must have an active selection for this session
                        $q->whereNotNull('session_selections.id');
                    }
                    // event_based: registration alone is sufficient — no extra clause
                })
                ->select([
                    'users.id as user_id',
                    'users.first_name',
                    'users.last_name',
                    'users.email',
                    'users.phone_number', // authorized: leader's assigned session only
                    'registrations.registration_status',
                    'attendance_records.status as attendance_status',
                    'attendance_records.check_in_method',
                    'attendance_records.checked_in_at',
                ])
                ->get();

            $roster[(string) $sessionId] = $participants->map(function ($p) {
                return [
                    'user' => [
                        'id'           => $p->user_id,
                        'first_name'   => $p->first_name,
                        'last_name'    => $p->last_name,
                        'email'        => $p->email,
                        'phone_number' => $p->phone_number,
                    ],
                    'registration_status' => $p->registration_status,
                    'attendance' => [
                        'status'          => $p->attendance_status ?? 'not_checked_in',
                        'check_in_method' => $p->check_in_method,
                        'checked_in_at'   => $p->checked_in_at,
                    ],
                ];
            })->values()->all();
        }

        return $roster;
    }
}
