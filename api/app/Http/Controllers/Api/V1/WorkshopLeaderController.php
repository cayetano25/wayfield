<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrganizerLeaderResource;
use App\Models\Leader;
use App\Models\Workshop;
use App\Models\WorkshopLeader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkshopLeaderController extends Controller
{
    /**
     * GET /api/v1/workshops/{workshop}/leaders
     * List all leaders attached to this workshop with their assigned sessions.
     */
    public function index(Request $request, Workshop $workshop): JsonResponse
    {
        $this->authorize('attachToWorkshop', [Leader::class, $workshop->organization]);

        $leaders = $workshop->leaders()
            ->with([
                'sessionLeaders' => function ($q) use ($workshop) {
                    $q->whereHas('session', fn ($s) => $s->where('workshop_id', $workshop->id))
                      ->with('session:id,title,start_at');
                },
                'invitations' => function ($q) use ($workshop) {
                    $q->where('workshop_id', $workshop->id);
                },
            ])
            ->get()
            ->map(function (Leader $leader) {
                $invitation = $leader->invitations->first();

                return [
                    'id'                    => $leader->id,
                    'first_name'            => $leader->first_name,
                    'last_name'             => $leader->last_name,
                    'display_name'          => $leader->display_name,
                    'bio'                   => $leader->bio,
                    'profile_image_url'     => $leader->profile_image_url,
                    'website_url'           => $leader->website_url,
                    'city'                  => $leader->city,
                    'state_or_region'       => $leader->state_or_region,
                    'phone_number'          => $leader->phone_number,
                    'invitation_status'     => $invitation?->status ?? 'accepted',
                    'invitation_id'         => $invitation?->id,
                    'invitation_created_at' => $invitation?->created_at?->toIso8601String(),
                    'is_confirmed'          => (bool) ($leader->pivot->is_confirmed ?? false),
                    'assigned_sessions'     => $assignedSessions = $leader->sessionLeaders
                        ->map(fn ($sl) => [
                            'id'         => $sl->session->id,
                            'title'      => $sl->session->title,
                            'start_at'   => $sl->session->start_at?->toIso8601String(),
                            'role_label' => $sl->role_label,
                        ])
                        ->values(),
                    'sessions_count'        => $assignedSessions->count(),
                ];
            });

        return response()->json($leaders);
    }

    /**
     * POST /api/v1/workshops/{workshop}/leaders
     * Associate an accepted leader to the workshop for public listing.
     * Only accepted org members (leaders) can be listed as confirmed.
     */
    public function store(Request $request, Workshop $workshop): JsonResponse
    {
        $this->authorize('attachToWorkshop', [Leader::class, $workshop->organization]);

        $request->validate([
            'leader_id'    => ['required', 'integer', 'exists:leaders,id'],
            'is_confirmed' => ['boolean'],
        ]);

        $leader = Leader::findOrFail($request->input('leader_id'));

        // Leader must be an active org member to be listed as confirmed
        $isOrgMember = $leader->organizationLeaders()
            ->where('organization_id', $workshop->organization_id)
            ->where('status', 'active')
            ->exists();

        if (! $isOrgMember) {
            return response()->json([
                'message' => 'Leader is not an active member of this organization.',
            ], 422);
        }

        $confirmed = $request->boolean('is_confirmed', false);

        $workshopLeader = WorkshopLeader::updateOrCreate(
            [
                'workshop_id' => $workshop->id,
                'leader_id'   => $leader->id,
            ],
            ['is_confirmed' => $confirmed]
        );

        return response()->json(new OrganizerLeaderResource($leader), 201);
    }
}
