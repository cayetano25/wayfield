<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\Organization;
use App\Models\User;
use App\Services\Address\AddressService;
use App\Services\Auth\RoleContextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function __construct(
        private readonly RoleContextService $roleContext,
        private readonly AddressService $addressService,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing('profile.address', 'leader');

        // Merge the UserResource fields with the role context summary.
        // Per ROLE_MODEL.md Section 0: one account, all roles, context-determined.
        return response()->json(array_merge(
            (new UserResource($user))->resolve($request),
            [
                'pronouns' => $user->pronouns,
                'onboarding_completed' => $user->hasCompletedOnboarding(),
                'profile' => $user->profile ? [
                    'phone_number' => $user->profile->phone_number,
                    'timezone' => $user->profile->timezone,
                    'address' => $user->profile->address
                        ? $this->addressService->toApiResponse($user->profile->address)
                        : null,
                ] : null,
                'leader_profile' => $user->leader ? [
                    'id'                => $user->leader->id,
                    'bio'               => $user->leader->bio,
                    'website_url'       => $user->leader->website_url,
                    'phone_number'      => $user->leader->phone_number,
                    'address_line_1'    => $user->leader->address_line_1,
                    'address_line_2'    => $user->leader->address_line_2,
                    'city'              => $user->leader->city,
                    'state_or_region'   => $user->leader->state_or_region,
                    'postal_code'       => $user->leader->postal_code,
                    'country'           => $user->leader->country,
                    'profile_image_url' => $user->leader->profile_image_url,
                ] : null,
                'contexts' => $this->buildContextSummary($user),
            ],
        ));
    }

    /**
     * Builds a summary of all role contexts the user holds.
     *
     * @return array{
     *   organization_roles: array<int, array{organization_id: int, organization_name: string|null, role: string}>,
     *   is_leader: bool,
     *   leader_id: int|null
     * }
     */
    private function buildContextSummary(User $user): array
    {
        $contexts = $this->roleContext->allContexts($user);

        $orgRoles = collect($contexts['organization_roles'])
            ->map(function (array $row) {
                $org = Organization::find($row['organization_id']);

                return [
                    'organization_id'   => $row['organization_id'],
                    'organization_name' => $org?->name,
                    'organization_slug' => $org?->slug,
                    'role'              => $row['role'],
                    'is_active'         => true,
                ];
            })
            ->values()
            ->toArray();

        return [
            'organization_roles' => $orgRoles,
            'is_leader' => $contexts['is_leader'],
            'leader_id' => $contexts['leader_id'],
        ];
    }

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        // Update users-table fields.
        $userFields = array_intersect_key($data, array_flip(['first_name', 'last_name', 'profile_image_url']));
        if (! empty($userFields)) {
            $user->update($userFields);
        }

        // Update user_profiles (phone_number, address).
        if (array_key_exists('phone_number', $data) || array_key_exists('address', $data)) {
            $user->loadMissing('profile');
            $profile = $user->profile ?? $user->profile()->create([]);

            if (array_key_exists('phone_number', $data)) {
                $profile->phone_number = $data['phone_number'];
            }

            if (! empty($data['address'])) {
                $profile->loadMissing('address');
                if ($profile->address_id && $profile->address) {
                    $this->addressService->updateFromRequest($profile->address, $data['address']);
                } else {
                    $address = $this->addressService->createFromRequest($data['address']);
                    $profile->address_id = $address->id;
                }
            }

            $profile->save();
            $user->load('profile.address');
        }

        return $this->show($request);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();

        if (! Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->update(['password' => Hash::make($validated['password'])]);

        return response()->json(['message' => 'Password changed successfully.']);
    }

    public function organizations(Request $request): JsonResponse
    {
        $user = $request->user();
        $memberships = $user->organizationUsers()
            ->where('is_active', true)
            ->with('organization.subscription')
            ->get();

        return response()->json(
            $memberships->map(function ($membership) {
                return [
                    'id' => $membership->organization->id,
                    'name' => $membership->organization->name,
                    'slug' => $membership->organization->slug,
                    'role' => $membership->role,
                    'status' => $membership->organization->status,
                    'plan_code' => $membership->organization->subscription?->plan_code ?? 'free',
                ];
            })->values()
        );
    }
}
