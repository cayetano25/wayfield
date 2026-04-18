<?php

namespace App\Domain\Leaders\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Domain\Webhooks\WebhookDispatcher;
use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\NotificationRecipient;
use App\Models\OrganizationLeader;
use App\Models\User;
use App\Models\WorkshopLeader;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AcceptLeaderInvitationAction
{
    public function __construct(private readonly WebhookDispatcher $webhookDispatcher) {}

    /**
     * Accept a leader invitation.
     *
     * - Creates or links a Leader record to the authenticated user's account.
     * - Creates an OrganizationLeader association.
     * - Creates a WorkshopLeader (confirmed) if the invitation was workshop-scoped.
     * - Updates the invitation status to 'accepted'.
     *
     * @param array{
     *   first_name: string,
     *   last_name: string,
     *   bio?: string|null,
     *   website_url?: string|null,
     *   phone_number?: string|null,
     *   city?: string|null,
     *   state_or_region?: string|null,
     *   address_line_1?: string|null,
     *   address_line_2?: string|null,
     *   postal_code?: string|null,
     *   country?: string|null,
     * } $profileData
     */
    public function execute(
        LeaderInvitation $invitation,
        User $user,
        array $profileData,
    ): Leader {
        return DB::transaction(function () use ($invitation, $user, $profileData) {
            // Reuse existing leader linked to this user, or create a new one
            $leader = Leader::where('user_id', $user->id)->first()
                ?? Leader::create([
                    'user_id' => $user->id,
                    'first_name' => $profileData['first_name'] ?? $user->first_name,
                    'last_name' => $profileData['last_name'] ?? $user->last_name,
                    'bio' => $profileData['bio'] ?? null,
                    'website_url' => $profileData['website_url'] ?? null,
                    'phone_number' => $profileData['phone_number'] ?? null,
                    'city' => $profileData['city'] ?? null,
                    'state_or_region' => $profileData['state_or_region'] ?? null,
                    'address_line_1' => $profileData['address_line_1'] ?? null,
                    'address_line_2' => $profileData['address_line_2'] ?? null,
                    'postal_code' => $profileData['postal_code'] ?? null,
                    'country' => $profileData['country'] ?? null,
                    'email' => $user->email,
                ]);

            // If leader already existed, update profile fields they provided
            if ($leader->wasRecentlyCreated === false) {
                $leader->update(array_filter([
                    'first_name' => $profileData['first_name'] ?? $leader->first_name,
                    'last_name' => $profileData['last_name'] ?? $leader->last_name,
                    'bio' => $profileData['bio'] ?? $leader->bio,
                    'website_url' => $profileData['website_url'] ?? $leader->website_url,
                    'phone_number' => $profileData['phone_number'] ?? $leader->phone_number,
                    'city' => $profileData['city'] ?? $leader->city,
                    'state_or_region' => $profileData['state_or_region'] ?? $leader->state_or_region,
                    'address_line_1' => $profileData['address_line_1'] ?? $leader->address_line_1,
                    'address_line_2' => $profileData['address_line_2'] ?? $leader->address_line_2,
                    'postal_code' => $profileData['postal_code'] ?? $leader->postal_code,
                    'country' => $profileData['country'] ?? $leader->country,
                ], fn ($v) => $v !== null));
            }

            // Link invitation to leader record
            $invitation->update([
                'leader_id' => $leader->id,
                'status' => 'accepted',
                'responded_at' => now(),
            ]);

            // Create organization association (idempotent)
            OrganizationLeader::firstOrCreate(
                [
                    'organization_id' => $invitation->organization_id,
                    'leader_id' => $leader->id,
                ],
                ['status' => 'active']
            );

            // If invitation was workshop-scoped, create confirmed workshop association
            if ($invitation->workshop_id) {
                WorkshopLeader::updateOrCreate(
                    [
                        'workshop_id' => $invitation->workshop_id,
                        'leader_id' => $leader->id,
                    ],
                    [
                        'invitation_id' => $invitation->id,
                        'is_confirmed' => true,
                    ]
                );
            }

            // Mark any delivered invitation notification as read so the badge clears
            NotificationRecipient::whereHas('notification', function ($q) use ($invitation) {
                $q->where('notification_category', 'invitation')
                    ->whereJsonContains('action_data->invitation_id', $invitation->id);
            })
                ->where('user_id', $user->id)
                ->where('in_app_status', 'delivered')
                ->update(['in_app_status' => 'read', 'read_at' => now()]);

            AuditLogService::record([
                'organization_id' => $invitation->organization_id,
                'actor_user_id' => $user->id,
                'entity_type' => 'leader_invitation',
                'entity_id' => $invitation->id,
                'action' => 'invitation_accepted',
                'metadata' => [
                    'leader_id' => $leader->id,
                    'workshop_id' => $invitation->workshop_id,
                ],
            ]);

            $fresh = $leader->fresh();

            // Dispatch webhook event — failure must NOT fail the primary action.
            try {
                $this->webhookDispatcher->dispatch(
                    'leader.invitation_accepted',
                    $invitation->organization_id,
                    [
                        'invitation_id' => $invitation->id,
                        'organization_id' => $invitation->organization_id,
                        'workshop_id' => $invitation->workshop_id,
                        'leader_id' => $fresh->id,
                        'first_name' => $fresh->first_name,
                        'last_name' => $fresh->last_name,
                        'accepted_at' => now()->toIso8601String(),
                    ]
                );
            } catch (\Throwable $e) {
                Log::warning('AcceptLeaderInvitationAction: webhook dispatch failed', [
                    'invitation_id' => $invitation->id,
                    'error' => $e->getMessage(),
                ]);
            }

            return $fresh;
        });
    }
}
