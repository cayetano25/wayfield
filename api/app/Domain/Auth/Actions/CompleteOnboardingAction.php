<?php

declare(strict_types=1);

namespace App\Domain\Auth\Actions;

use App\Domain\Organizations\Actions\CreateOrganizationAction;
use App\Models\AuditLog;
use App\Models\LeaderInvitation;
use App\Models\Registration;
use App\Models\User;
use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Processes the onboarding intent and performs the first contextual action.
 *
 * Intent outcomes:
 *   join_workshop       → create a Registration row for the given join_code
 *   create_organization → create the org and make the user the owner
 *   accept_invitation   → link the leader invitation to this user
 *   exploring           → mark onboarding complete, no other action
 *
 * After any intent: sets onboarding_completed_at = now().
 *
 * @return array{ redirect: string, message: string, organization_id: int|null }
 */
final class CompleteOnboardingAction
{
    public function __construct(
        private readonly CreateOrganizationAction $createOrg
    ) {}

    public function execute(User $user, array $data): array
    {
        $intent = $data['intent'];
        $result = [];

        DB::transaction(function () use ($user, $data, $intent, &$result) {
            $result = match ($intent) {
                'join_workshop' => $this->joinWorkshop($user, $data),
                'create_organization' => $this->createOrganization($user, $data),
                'accept_invitation' => $this->acceptInvitation($user, $data),
                'exploring' => $this->exploring(),
            };

            // Mark onboarding complete regardless of intent outcome.
            $user->update(['onboarding_completed_at' => Carbon::now()]);

            AuditLog::create([
                'organization_id' => $result['organization_id'] ?? null,
                'actor_user_id' => $user->id,
                'entity_type' => 'user',
                'entity_id' => $user->id,
                'action' => 'user.onboarding_completed',
                'metadata_json' => ['intent' => $intent],
            ]);
        });

        return $result;
    }

    private function joinWorkshop(User $user, array $data): array
    {
        $workshop = Workshop::where('join_code', $data['join_code'])
            ->where('status', 'published')
            ->firstOrFail();

        $existing = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            return [
                'redirect' => '/my-workshops',
                'message' => 'You are already registered for this workshop.',
                'organization_id' => null,
            ];
        }

        Registration::create([
            'workshop_id' => $workshop->id,
            'user_id' => $user->id,
            'registration_status' => 'registered',
            'joined_via_code' => $data['join_code'],
            'registered_at' => now(),
        ]);

        return [
            'redirect' => '/my-workshops',
            'message' => "You've joined {$workshop->title}!",
            'organization_id' => null,
            'workshop_id' => $workshop->id,
        ];
    }

    private function createOrganization(User $user, array $data): array
    {
        $org = $this->createOrg->execute($user, [
            'name' => $data['organization_name'],
            'slug' => $data['organization_slug'],
            'primary_contact_first_name' => $user->first_name,
            'primary_contact_last_name' => $user->last_name,
            'primary_contact_email' => $user->email,
        ]);

        return [
            'redirect' => '/dashboard',
            'message' => 'Your organization has been created!',
            'organization_id' => $org->id,
        ];
    }

    private function acceptInvitation(User $user, array $data): array
    {
        // Tokens are stored hashed. Hash the incoming token for comparison.
        $tokenHash = hash('sha256', $data['invitation_token']);

        $invitation = LeaderInvitation::where('status', 'pending')
            ->where('expires_at', '>', now())
            ->where('invitation_token_hash', $tokenHash)
            ->first();

        if (! $invitation) {
            return [
                'redirect' => '/dashboard',
                'message' => 'Invitation not found or expired. Check your email for a valid link.',
                'organization_id' => null,
            ];
        }

        // Link the user to the leader record and accept.
        $invitation->leader->update(['user_id' => $user->id]);
        $invitation->update([
            'status' => 'accepted',
            'responded_at' => now(),
        ]);

        return [
            'redirect' => '/leader/dashboard',
            'message' => 'Invitation accepted! Welcome to the team.',
            'organization_id' => $invitation->organization_id,
        ];
    }

    private function exploring(): array
    {
        return [
            'redirect' => '/dashboard',
            'message' => 'Welcome to Wayfield!',
            'organization_id' => null,
        ];
    }
}
