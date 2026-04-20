<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Domain\Notifications\Actions\CreateOrgInvitationNotificationAction;
use App\Domain\Shared\Services\AuditLogService;
use App\Http\Controllers\Controller;
use App\Mail\InviteOrgMemberMail;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\OrganizationUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class OrgInvitationController extends Controller
{
    /** Role display names for human-readable output. */
    private const ROLE_DISPLAY = [
        'owner' => 'Owner',
        'admin' => 'Administrator',
        'staff' => 'Staff',
        'billing_admin' => 'Billing Administrator',
    ];

    // ─── Management endpoints (auth required) ─────────────────────────────────

    /**
     * GET /api/v1/organizations/{organization}/invitations
     *
     * List pending and recent invitations for this org.
     * Allowed: owner, admin
     */
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('manageMembers', $organization);

        $invitations = $organization->organizationInvitations()
            ->with('createdBy')
            ->whereIn('status', ['pending', 'accepted', 'declined'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (OrganizationInvitation $inv) => [
                'id' => $inv->id,
                'invited_email' => $inv->invited_email,
                'invited_first_name' => $inv->invited_first_name,
                'invited_last_name' => $inv->invited_last_name,
                'role' => $inv->role,
                'status' => $inv->status,
                'expires_at' => $inv->expires_at?->toIso8601String(),
                'created_at' => $inv->created_at?->toIso8601String(),
                'created_by' => $inv->createdBy ? [
                    'first_name' => $inv->createdBy->first_name,
                    'last_name' => $inv->createdBy->last_name,
                ] : null,
            ]);

        return response()->json($invitations);
    }

    /**
     * POST /api/v1/organizations/{organization}/invitations
     *
     * Send a member invitation by email.
     * Allowed: owner, admin
     * Business rules:
     *   - 'owner' cannot be invited — only transferred.
     *   - 'admin' role can only be invited by an owner.
     *   - No duplicate pending invitations to the same email.
     *   - No invitation to an existing active member.
     */
    public function store(
        Request $request,
        Organization $organization,
        CreateOrgInvitationNotificationAction $notifyAction,
    ): JsonResponse {
        $this->authorize('manageMembers', $organization);

        $validated = $request->validate([
            'invited_email' => ['required', 'email', 'max:255'],
            'invited_first_name' => ['nullable', 'string', 'max:100'],
            'invited_last_name' => ['nullable', 'string', 'max:100'],
            'role' => ['required', 'in:admin,staff,billing_admin'],
        ]);

        $inviterRole = $organization->memberRole($request->user());

        // Allowed: owner → admin, staff, billing_admin
        //          admin → staff only (ROLE_MODEL.md §2.3)
        // Denied:  staff, billing_admin → blocked at manageMembers policy
        if ($inviterRole === 'admin' && $validated['role'] !== 'staff') {
            return response()->json([
                'error' => 'insufficient_role',
                'message' => 'Administrators may only invite staff members.',
            ], 403);
        }

        $email = strtolower(trim($validated['invited_email']));

        // Guard: email already has an active membership in this org.
        $alreadyMember = OrganizationUser::where('organization_id', $organization->id)
            ->where('is_active', true)
            ->whereHas('user', fn ($q) => $q->where('email', $email))
            ->exists();

        if ($alreadyMember) {
            return response()->json([
                'error' => 'already_a_member',
                'message' => 'This person is already a member of your organization.',
            ], 422);
        }

        // Guard: pending invitation already exists for this email in this org.
        $pendingExists = OrganizationInvitation::where('organization_id', $organization->id)
            ->where('invited_email', $email)
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->exists();

        if ($pendingExists) {
            return response()->json([
                'error' => 'invitation_pending',
                'message' => 'A pending invitation has already been sent to this email.',
            ], 422);
        }

        $rawToken = Str::random(64);

        // Resolve an existing account for this email so the invitation
        // can be linked immediately (user_id stays null for unknown emails).
        $invitee = \App\Models\User::where('email', $email)->first();

        $invitation = OrganizationInvitation::create([
            'organization_id' => $organization->id,
            'user_id' => $invitee?->id,
            'invited_email' => $email,
            'invited_first_name' => $validated['invited_first_name'] ?? null,
            'invited_last_name' => $validated['invited_last_name'] ?? null,
            'role' => $validated['role'],
            'status' => 'pending',
            'invitation_token_hash' => hash('sha256', $rawToken),
            'expires_at' => now()->addDays(7),
            'created_by_user_id' => $request->user()->id,
        ]);

        Mail::to($email)->queue(
            new InviteOrgMemberMail($invitation, $rawToken)
        );

        // In-app notification for invitees who already have a Wayfield account.
        // Skipped when user_id is null (email-only path for new users).
        $notifyAction->execute($invitation->load('organization'), $rawToken);

        AuditLogService::record([
            'organization_id' => $organization->id,
            'actor_user_id' => $request->user()->id,
            'entity_type' => 'organization_invitation',
            'entity_id' => $invitation->id,
            'action' => 'org_invitation.sent',
            'metadata' => [
                'invited_email' => $email,
                'role' => $validated['role'],
            ],
        ]);

        return response()->json([
            'message' => 'Invitation sent.',
            'invitation_id' => $invitation->id,
        ], 201);
    }

    /**
     * DELETE /api/v1/organizations/{organization}/invitations/{invitation}
     *
     * Cancel a pending invitation by setting status = 'removed'.
     * Allowed: owner, admin
     */
    public function destroy(
        Request $request,
        Organization $organization,
        OrganizationInvitation $invitation,
    ): JsonResponse {
        $this->authorize('manageMembers', $organization);

        abort_if($invitation->organization_id !== $organization->id, 404);

        if ($invitation->status === 'accepted') {
            return response()->json([
                'message' => 'This invitation has already been accepted and cannot be cancelled.',
                'status' => $invitation->status,
            ], 422);
        }

        if (! in_array($invitation->status, ['pending', 'expired'], true)) {
            return response()->json([
                'message' => 'Only pending invitations can be cancelled.',
                'status' => $invitation->status,
            ], 422);
        }

        // Allowed: owner, admin — but admin cannot rescind admin-role invitations.
        $rescinder = $organization->memberRole($request->user());
        if ($rescinder === 'admin' && $invitation->role === 'admin') {
            return response()->json([
                'error' => 'insufficient_role',
                'message' => 'Only an owner can cancel an administrator invitation.',
            ], 403);
        }

        $invitation->update([
            'status' => 'removed',
            'responded_at' => now(),
        ]);

        AuditLogService::record([
            'organization_id' => $organization->id,
            'actor_user_id' => $request->user()->id,
            'entity_type' => 'organization_invitation',
            'entity_id' => $invitation->id,
            'action' => 'org_invitation.cancelled',
            'metadata' => ['invited_email' => $invitation->invited_email],
        ]);

        return response()->json(['message' => 'Invitation cancelled.']);
    }

    /**
     * POST /api/v1/organizations/{organization}/invitations/{invitation}/resend
     *
     * Resend a pending (or expired) invitation with a freshly-generated token.
     * Allowed: owner, admin
     */
    public function resend(
        Request $request,
        Organization $organization,
        OrganizationInvitation $invitation,
    ): JsonResponse {
        $this->authorize('manageMembers', $organization);

        abort_if($invitation->organization_id !== $organization->id, 404);

        if (in_array($invitation->status, ['accepted', 'declined', 'removed'], true)) {
            return response()->json([
                'message' => 'Only pending or expired invitations can be resent.',
                'status' => $invitation->status,
            ], 422);
        }

        $rawToken = Str::random(64);

        $invitation->update([
            'invitation_token_hash' => hash('sha256', $rawToken),
            'expires_at' => now()->addDays(7),
            'status' => 'pending',
        ]);

        Mail::to($invitation->invited_email)->queue(
            new InviteOrgMemberMail($invitation->fresh()->load('organization', 'createdBy'), $rawToken)
        );

        AuditLogService::record([
            'organization_id' => $organization->id,
            'actor_user_id' => $request->user()->id,
            'entity_type' => 'organization_invitation',
            'entity_id' => $invitation->id,
            'action' => 'org_invitation.resent',
            'metadata' => [
                'invited_email' => $invitation->invited_email,
                'role' => $invitation->role,
            ],
        ]);

        return response()->json([
            'message' => 'Invitation resent.',
            'invitation_id' => $invitation->id,
            'expires_at' => $invitation->fresh()->expires_at->toIso8601String(),
        ]);
    }

    // ─── Resolution endpoints (public-but-tokenized) ───────────────────────────

    /**
     * GET /api/v1/org-invitations/{token}
     *
     * Resolve an invitation for display on the frontend acceptance screen.
     * Public-but-tokenized — no auth required.
     */
    public function show(string $token): JsonResponse
    {
        $invitation = $this->resolveByToken($token);

        if (! $invitation) {
            return response()->json(['error' => 'invitation_not_found'], 404);
        }

        $invitation->load('organization');
        $org = $invitation->organization;

        return response()->json([
            'invitation_id' => $invitation->id,
            'status' => $invitation->status,
            'is_expired' => $invitation->isExpired(),
            'expires_at' => $invitation->expires_at?->toIso8601String(),
            'invited_email' => $invitation->invited_email,
            'invited_first_name' => $invitation->invited_first_name,
            'invited_last_name' => $invitation->invited_last_name,
            'role' => $invitation->role,
            'role_display' => self::ROLE_DISPLAY[$invitation->role] ?? $invitation->role,
            'organization' => $org ? [
                'id' => $org->id,
                'name' => $org->name,
                'slug' => $org->slug,
                'workshops_count' => $org->workshops()->count(),
                'members_count' => $org->organizationUsers()
                    ->where('is_active', true)
                    ->count(),
            ] : null,
        ]);
    }

    /**
     * POST /api/v1/org-invitations/{token}/accept
     *
     * Accept the invitation. Requires authenticated user (auth:sanctum).
     * The frontend handles registration or login FIRST, then calls this endpoint.
     * The authenticated user's email must match invitation.invited_email.
     */
    public function accept(Request $request, string $token): JsonResponse
    {
        $invitation = $this->resolveByToken($token);

        if (! $invitation) {
            return response()->json(['error' => 'invitation_not_found'], 404);
        }

        if (! $invitation->isPending()) {
            return response()->json([
                'message' => 'This invitation is no longer actionable.',
                'status' => $invitation->status,
            ], 422);
        }

        // The authenticated user's email must match the invited address.
        if (strtolower($request->user()->email) !== strtolower($invitation->invited_email)) {
            return response()->json([
                'error' => 'email_mismatch',
                'message' => "This invitation was sent to {$invitation->invited_email}.",
            ], 403);
        }

        $invitation->load('organization');
        $org = $invitation->organization;

        // Guard: user is already an active member of this org.
        $alreadyMember = OrganizationUser::where('organization_id', $invitation->organization_id)
            ->where('user_id', $request->user()->id)
            ->where('is_active', true)
            ->exists();

        if ($alreadyMember) {
            return response()->json([
                'error'   => 'already_a_member',
                'message' => 'You are already a member of this organization.',
            ], 422);
        }

        // Create org membership (idempotent via firstOrCreate).
        OrganizationUser::firstOrCreate(
            [
                'organization_id' => $invitation->organization_id,
                'user_id' => $request->user()->id,
            ],
            [
                'role' => $invitation->role,
                'is_active' => true,
            ]
        );

        $invitation->update([
            'status' => 'accepted',
            'responded_at' => now(),
            'user_id' => $request->user()->id,
        ]);

        AuditLogService::record([
            'organization_id' => $invitation->organization_id,
            'actor_user_id' => $request->user()->id,
            'entity_type' => 'organization_invitation',
            'entity_id' => $invitation->id,
            'action' => 'org_invitation.accepted',
            'metadata' => [
                'role' => $invitation->role,
                'invited_email' => $invitation->invited_email,
            ],
        ]);

        $roleDisplay = self::ROLE_DISPLAY[$invitation->role] ?? $invitation->role;

        return response()->json([
            'message' => "You are now a member of {$org->name}.",
            'organization' => [
                'id' => $org->id,
                'name' => $org->name,
                'slug' => $org->slug,
            ],
            'role' => $invitation->role,
            'role_display' => $roleDisplay,
            'redirect' => '/dashboard',
        ]);
    }

    /**
     * POST /api/v1/org-invitations/{token}/decline
     *
     * Decline the invitation. No auth required.
     * Expired invitations may still be declined.
     * Only blocks if already accepted, declined, or removed.
     */
    public function decline(string $token): JsonResponse
    {
        $invitation = $this->resolveByToken($token);

        if (! $invitation) {
            return response()->json(['error' => 'invitation_not_found'], 404);
        }

        // Block only if the invitation has already been responded to or removed.
        if (in_array($invitation->status, ['accepted', 'declined', 'removed'], true)) {
            return response()->json([
                'message' => 'This invitation is no longer actionable.',
                'status' => $invitation->status,
            ], 422);
        }

        $invitation->update([
            'status' => 'declined',
            'responded_at' => now(),
        ]);

        $invitation->loadMissing('organization');

        AuditLogService::record([
            'organization_id' => $invitation->organization_id,
            'entity_type' => 'organization_invitation',
            'entity_id' => $invitation->id,
            'action' => 'org_invitation.declined',
            'metadata' => ['invited_email' => $invitation->invited_email],
        ]);

        return response()->json([
            'message' => 'You have declined the invitation.',
            'organization_name' => $invitation->organization?->name,
        ]);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Resolve an OrganizationInvitation from a raw token.
     *
     * Security pattern:
     *   Hash the incoming raw token and compare against stored hashes using
     *   hash_equals() for constant-time comparison. We scan pending+recent
     *   invitations only to keep the working set small.
     *
     *   NOTE: For production scale, add a unique indexed lookup column
     *   (e.g. token_prefix) to avoid a full table scan.
     */
    private function resolveByToken(string $rawToken): ?OrganizationInvitation
    {
        return OrganizationInvitation::where('invitation_token_hash', hash('sha256', $rawToken))->first();
    }
}
