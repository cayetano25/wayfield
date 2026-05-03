<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Platform;

use App\Domain\Platform\Services\PlatformAuditService;
use App\Http\Controllers\Controller;
use App\Models\FeatureFlag;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PlatformOrganizationController extends Controller
{
    public function __construct(private readonly PlatformAuditService $audit) {}

    /**
     * GET /api/platform/v1/organizations
     * Paginated list of all organizations with subscription and usage data.
     */
    public function index(Request $request): JsonResponse
    {
        $organizations = Organization::query()
            ->with(['subscription', 'organizationUsers' => fn ($q) => $q->where('is_active', true)])
            ->withCount([
                'workshops',
                'workshops as active_workshops_count' => fn ($q) => $q->where('status', 'published'),
            ])
            ->when($request->input('search'), fn ($q, $search) => $q->where(
                fn ($q) => $q->where('name', 'like', "%{$search}%")
                             ->orWhere('slug', 'like', "%{$search}%")
            ))
            ->when($request->input('plan'), fn ($q, $plan) => $q->whereHas(
                'subscription', fn ($q) => $q->where('plan_code', $plan)
            ))
            ->when($request->input('status'), fn ($q, $status) => $q->where('status', $status))
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 25));

        return response()->json($organizations);
    }

    /**
     * GET /api/platform/v1/organizations/{organization}
     * Full organization detail for platform review.
     */
    public function show(Organization $organization): JsonResponse
    {
        $organization->load([
            'subscription',
            'organizationUsers.user',
            'workshops' => fn ($q) => $q->orderBy('created_at', 'desc')->limit(10),
        ]);
        $organization->loadCount(['workshops', 'organizationUsers']);

        $planCode = $organization->subscription?->plan_code ?? 'foundation';
        $limits = $this->planLimits($planCode);

        $leaderCompletion = $this->leaderCompletionSummary($organization->id);

        return response()->json([
            'id' => $organization->id,
            'name' => $organization->name,
            'slug' => $organization->slug,
            'status' => $organization->status,
            'contact_email' => $organization->primary_contact_email,
            'contact_phone' => $organization->primary_contact_phone,
            'created_at' => $organization->created_at,
            'updated_at' => $organization->updated_at,
            'subscription' => $organization->subscription ? [
                'plan_code' => $organization->subscription->plan_code,
                'status' => $organization->subscription->status,
                'current_period_start' => $organization->subscription->current_period_start,
                'current_period_end' => $organization->subscription->current_period_end,
            ] : null,
            'usage' => [
                'workshop_count' => $organization->workshops_count,
                'workshop_limit' => $limits['active_workshops'],
                'participant_count' => DB::table('registrations')
                    ->join('workshops', 'registrations.workshop_id', '=', 'workshops.id')
                    ->where('workshops.organization_id', $organization->id)
                    ->where('registrations.registration_status', 'registered')
                    ->count(),
                'participant_limit' => $limits['participants_per_workshop'],
                'manager_count' => $organization->organization_users_count,
                'manager_limit' => $limits['organizers'],
            ],
            'leader_completion' => $leaderCompletion,
        ]);
    }

    /**
     * GET /api/platform/v1/organizations/{id}/leader-completion
     * Detailed leader profile completion report for an organisation.
     */
    public function leaderCompletion(Request $request, int $id): JsonResponse
    {
        $organization = Organization::findOrFail($id);

        $leaders = DB::table('leaders')
            ->join('organization_leaders', 'leaders.id', '=', 'organization_leaders.leader_id')
            ->leftJoin('leader_invitations', function ($join) use ($id) {
                $join->on('leader_invitations.leader_id', '=', 'leaders.id')
                     ->where('leader_invitations.organization_id', '=', $id);
            })
            ->where('organization_leaders.organization_id', $id)
            ->select(
                'leaders.id',
                'leaders.first_name',
                'leaders.last_name',
                'leaders.email',
                'leaders.bio',
                'leaders.profile_image_url',
                'leaders.website_url',
                'leaders.phone_number',
                DB::raw('MAX(leader_invitations.status) as invitation_status')
            )
            ->groupBy(
                'leaders.id',
                'leaders.first_name',
                'leaders.last_name',
                'leaders.email',
                'leaders.bio',
                'leaders.profile_image_url',
                'leaders.website_url',
                'leaders.phone_number'
            )
            ->get();

        $leaderData = $leaders->map(function ($leader) {
            $accepted   = $leader->invitation_status === 'accepted';
            $hasBio     = !empty($leader->bio) && strlen($leader->bio) > 20;
            $hasImage   = !empty($leader->profile_image_url);
            $hasContact = !empty($leader->website_url) || !empty($leader->phone_number) || !empty($leader->email);

            $missing = [];
            if (!$accepted)   $missing[] = 'invitation not accepted';
            if (!$hasBio)     $missing[] = 'bio missing or too short';
            if (!$hasImage)   $missing[] = 'profile image missing';
            if (!$hasContact) $missing[] = 'no contact information';

            return [
                'leader_id'         => $leader->id,
                'first_name'        => $leader->first_name,
                'last_name'         => $leader->last_name,
                'email'             => $leader->email,
                'invitation_status' => $leader->invitation_status ?? 'pending',
                'profile_complete'  => $accepted && $hasBio && $hasImage && $hasContact,
                'missing_fields'    => $missing,
            ];
        });

        $total     = $leaderData->count();
        $completed = $leaderData->where('profile_complete', true)->count();
        $rate      = $total > 0 ? round(($completed / $total) * 100, 1) : 0.0;

        return response()->json([
            'organization_id'    => $organization->id,
            'organization_name'  => $organization->name,
            'total_leaders'      => $total,
            'completed_profiles' => $completed,
            'incomplete_profiles' => $total - $completed,
            'completion_rate_pct' => $rate,
            'leaders'            => $leaderData->values(),
        ]);
    }

    /**
     * PATCH /api/platform/v1/organizations/{organization}/status
     * Update organization status. Writes to platform_audit_logs.
     */
    public function updateStatus(Request $request, Organization $organization): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['active', 'suspended', 'inactive'])],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $oldStatus = $organization->status;
        $organization->update(['status' => $data['status']]);

        $this->audit->record(
            action: 'organization.status_changed',
            adminUser: $request->user('platform_admin'),
            options: [
                'entity_type' => 'organization',
                'entity_id' => $organization->id,
                'organization_id' => $organization->id,
                'metadata_json' => [
                    'old_status' => $oldStatus,
                    'new_status' => $data['status'],
                    'reason' => $data['reason'],
                ],
                'ip_address' => $request->ip(),
            ]
        );

        return response()->json([
            'id' => $organization->id,
            'status' => $organization->status,
        ]);
    }

    /**
     * POST /api/platform/v1/organizations/{organization}/billing/plan
     * Change an organization's subscription plan. super_admin and billing only.
     */
    public function changePlan(Request $request, Organization $organization): JsonResponse
    {
        $admin = $request->user('platform_admin');

        if (! $admin->canManageBilling()) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'plan_code' => ['required', Rule::in(['foundation', 'creator', 'studio', 'enterprise'])],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $subscription = $organization->subscription;
        $oldPlan = $subscription?->plan_code ?? 'foundation';

        if ($subscription) {
            $subscription->update(['plan_code' => $data['plan_code']]);
        } else {
            $subscription = $organization->subscriptions()->create([
                'plan_code' => $data['plan_code'],
                'status' => 'active',
                'starts_at' => now(),
            ]);
        }

        $this->audit->record(
            action: 'organization.plan_changed',
            adminUser: $admin,
            options: [
                'entity_type' => 'organization',
                'entity_id' => $organization->id,
                'organization_id' => $organization->id,
                'metadata_json' => [
                    'old_plan' => $oldPlan,
                    'new_plan' => $data['plan_code'],
                    'reason' => $data['reason'],
                ],
                'ip_address' => $request->ip(),
            ]
        );

        return response()->json([
            'organization_id' => $organization->id,
            'plan_code' => $subscription->fresh()->plan_code,
            'status' => $subscription->status,
        ]);
    }

    /**
     * GET /api/platform/v1/organizations/{organization}/feature-flags
     * Returns all feature flag definitions with this org's override state.
     */
    public function featureFlags(Organization $organization): JsonResponse
    {
        $catalog = DB::table('feature_flags')->get()->keyBy('feature_key');
        $overrides = FeatureFlag::where('organization_id', $organization->id)
            ->get()
            ->keyBy('feature_key');

        $planCode = $organization->subscription?->plan_code ?? 'foundation';

        $flags = $catalog->map(function ($definition) use ($overrides, $planCode) {
            $override = $overrides->get($definition->feature_key);
            $planDefaults = json_decode($definition->plan_defaults ?? '{}', true);
            $planDefault = $planDefaults[$planCode] ?? $definition->default_enabled;

            return [
                'feature_key' => $definition->feature_key,
                'description' => $definition->description,
                'is_enabled' => $override ? $override->is_enabled : $planDefault,
                'source' => $override ? 'manual_override' : 'plan_default',
            ];
        });

        return response()->json($flags->values());
    }

    /**
     * POST /api/platform/v1/organizations/{organization}/feature-flags
     * Set a per-org feature flag override. super_admin and admin only.
     */
    public function setFeatureFlag(Request $request, Organization $organization): JsonResponse
    {
        $data = $request->validate([
            'feature_key' => ['required', 'string', 'max:100'],
            'is_enabled' => ['required', 'boolean'],
        ]);

        $admin = $request->user('platform_admin');

        $existing = FeatureFlag::where('organization_id', $organization->id)
            ->where('feature_key', $data['feature_key'])
            ->first();
        $oldEnabled = $existing?->is_enabled;

        $flag = FeatureFlag::updateOrCreate(
            ['organization_id' => $organization->id, 'feature_key' => $data['feature_key']],
            [
                'is_enabled' => $data['is_enabled'],
                'source' => 'manual_override',
                'set_by_admin_user_id' => $admin->id,
            ]
        );

        $this->audit->record(
            action: 'feature_flag_override',
            adminUser: $admin,
            options: [
                'entity_type' => 'organization_feature_flag',
                'entity_id' => $flag->id,
                'organization_id' => $organization->id,
                'metadata_json' => [
                    'feature_key' => $data['feature_key'],
                    'old_enabled' => $oldEnabled,
                    'new_enabled' => $data['is_enabled'],
                ],
                'ip_address' => $request->ip(),
            ]
        );

        return response()->json([
            'organization_id' => $organization->id,
            'feature_key' => $flag->feature_key,
            'is_enabled' => $flag->is_enabled,
            'source' => $flag->source,
        ]);
    }

    private function leaderCompletionSummary(int $organizationId): array
    {
        $leaders = DB::table('leaders')
            ->join('organization_leaders', 'leaders.id', '=', 'organization_leaders.leader_id')
            ->leftJoin('leader_invitations', function ($join) use ($organizationId) {
                $join->on('leader_invitations.leader_id', '=', 'leaders.id')
                     ->where('leader_invitations.organization_id', '=', $organizationId);
            })
            ->where('organization_leaders.organization_id', $organizationId)
            ->select(
                'leaders.bio',
                'leaders.profile_image_url',
                'leaders.website_url',
                'leaders.phone_number',
                'leaders.email',
                DB::raw('MAX(leader_invitations.status) as invitation_status')
            )
            ->groupBy(
                'leaders.id',
                'leaders.bio',
                'leaders.profile_image_url',
                'leaders.website_url',
                'leaders.phone_number',
                'leaders.email'
            )
            ->get();

        $total     = $leaders->count();
        $completed = $leaders->filter(function ($leader) {
            $accepted   = $leader->invitation_status === 'accepted';
            $hasBio     = !empty($leader->bio) && strlen($leader->bio) > 20;
            $hasImage   = !empty($leader->profile_image_url);
            $hasContact = !empty($leader->website_url) || !empty($leader->phone_number) || !empty($leader->email);
            return $accepted && $hasBio && $hasImage && $hasContact;
        })->count();

        return [
            'total'               => $total,
            'complete'            => $completed,
            'completion_rate_pct' => $total > 0 ? round(($completed / $total) * 100, 1) : 0.0,
        ];
    }

    private function planLimits(string $planCode): array
    {
        return match ($planCode) {
            'creator' => ['active_workshops' => 10, 'participants_per_workshop' => 250, 'organizers' => 10],
            'studio', 'enterprise' => ['active_workshops' => null, 'participants_per_workshop' => null, 'organizers' => null],
            default => ['active_workshops' => 2, 'participants_per_workshop' => 75, 'organizers' => 3],
        };
    }
}
