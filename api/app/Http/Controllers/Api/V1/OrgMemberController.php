<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Domain\Organizations\Actions\ChangeOrgMemberRoleAction;
use App\Domain\Organizations\Actions\RemoveOrgMemberAction;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\OrganizationUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrgMemberController extends Controller
{
    /**
     * GET /api/v1/organizations/{organization}/members
     *
     * Allowed: owner, admin, staff (all active org members)
     */
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('viewMembers', $organization);

        $roleOrder = ['owner' => 0, 'admin' => 1, 'staff' => 2, 'billing_admin' => 3];

        $members = $organization->organizationUsers()
            ->with('user')
            ->where('is_active', true)
            ->get()
            ->sortBy(fn (OrganizationUser $m) => $roleOrder[$m->role] ?? 99)
            ->values()
            ->map(fn (OrganizationUser $m) => [
                'id' => $m->id,
                'user' => [
                    'id' => $m->user->id,
                    'first_name' => $m->user->first_name,
                    'last_name' => $m->user->last_name,
                    'email' => $m->user->email,
                    'profile_image_url' => $m->user->profile_image_url,
                ],
                'role' => $m->role,
                'is_active' => $m->is_active,
                'joined_at' => $m->created_at->toIso8601String(),
            ]);

        $pendingInvitations = $organization->organizationInvitations()
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (OrganizationInvitation $inv) => [
                'id' => $inv->id,
                'invited_email' => $inv->invited_email,
                'invited_first_name' => $inv->invited_first_name,
                'invited_last_name' => $inv->invited_last_name,
                'role' => $inv->role,
                'status' => $inv->status,
                'expires_at' => $inv->expires_at->toIso8601String(),
                'created_at' => $inv->created_at->toIso8601String(),
            ]);

        return response()->json([
            'members' => $members,
            'pending_invitations' => $pendingInvitations,
        ]);
    }

    /**
     * PATCH /api/v1/organizations/{organization}/members/{organizationUser}
     *
     * Change a member's role.
     * Allowed: owner only
     */
    public function changeRole(
        Request $request,
        Organization $organization,
        OrganizationUser $organizationUser,
        ChangeOrgMemberRoleAction $action,
    ): JsonResponse {
        $this->authorize('changeRole', $organization);

        abort_if($organizationUser->organization_id !== $organization->id, 404);

        $validated = $request->validate([
            // owner is excluded — ownership is transferred, not assigned.
            'role' => ['required', 'string', 'in:admin,staff,billing_admin'],
        ]);

        if ($organizationUser->user_id === $request->user()->id) {
            return response()->json([
                'error' => 'cannot_change_own_role',
                'message' => 'You cannot change your own role.',
            ], 422);
        }

        if ($organizationUser->role === 'owner') {
            return response()->json([
                'error' => 'cannot_change_owner',
                'message' => "The organization owner's role cannot be changed.",
            ], 422);
        }

        $updated = $action->execute($organizationUser, $validated['role'], $request->user());
        $updated->load('user');

        return response()->json($this->formatMember($updated));
    }

    /**
     * DELETE /api/v1/organizations/{organization}/members/{organizationUser}
     *
     * Soft-remove a member (is_active = false).
     * Allowed: owner (anyone except owner role and self)
     *          admin (staff only)
     */
    public function remove(
        Request $request,
        Organization $organization,
        OrganizationUser $organizationUser,
        RemoveOrgMemberAction $action,
    ): JsonResponse {
        $this->authorize('removeMembers', $organization);

        abort_if($organizationUser->organization_id !== $organization->id, 404);

        if ($organizationUser->user_id === $request->user()->id) {
            return response()->json([
                'error' => 'cannot_remove_self',
                'message' => 'You cannot remove yourself. Transfer ownership first.',
            ], 422);
        }

        if ($organizationUser->role === 'owner') {
            return response()->json([
                'error' => 'cannot_remove_owner',
                'message' => 'The organization owner cannot be removed.',
            ], 422);
        }

        // Allowed: owner, admin
        // Admin is restricted to removing staff members only.
        $requesterRole = $organization->memberRole($request->user());
        if ($requesterRole === 'admin' && $organizationUser->role !== 'staff') {
            return response()->json([
                'error' => 'insufficient_role',
                'message' => 'Administrators can only remove staff members.',
            ], 403);
        }

        $action->execute($organizationUser, $request->user());

        return response()->json(['message' => 'Member removed.']);
    }

    private function formatMember(OrganizationUser $m): array
    {
        return [
            'id' => $m->id,
            'user' => [
                'id' => $m->user->id,
                'first_name' => $m->user->first_name,
                'last_name' => $m->user->last_name,
                'email' => $m->user->email,
                'profile_image_url' => $m->user->profile_image_url,
            ],
            'role' => $m->role,
            'is_active' => $m->is_active,
            'joined_at' => $m->created_at->toIso8601String(),
        ];
    }
}
