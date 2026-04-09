<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\Organization;
use App\Models\User;
use App\Services\Auth\RoleContextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function __construct(private readonly RoleContextService $roleContext) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        // Merge the UserResource fields with the role context summary.
        // Per ROLE_MODEL.md Section 0: one account, all roles, context-determined.
        return response()->json(array_merge(
            (new UserResource($user))->resolve($request),
            ['contexts' => $this->buildContextSummary($user)],
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
                    'organization_id' => $row['organization_id'],
                    'organization_name' => $org?->name,
                    'role' => $row['role'],
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

    public function update(UpdateProfileRequest $request): UserResource
    {
        $request->user()->update($request->validated());

        return new UserResource($request->user()->fresh());
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
