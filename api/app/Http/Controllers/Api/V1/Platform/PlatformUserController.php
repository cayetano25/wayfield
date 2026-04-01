<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformUserController extends Controller
{
    /**
     * GET /api/v1/platform/users
     * Global paginated listing of all users.
     * Accessible by: super_admin, support
     */
    public function index(Request $request): JsonResponse
    {
        $users = User::query()
            ->with(['organizationUsers.organization'])
            ->when($request->input('search'), fn ($q, $search) =>
                $q->where(fn ($q) => $q
                    ->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                )
            )
            ->when($request->boolean('email_verified'), fn ($q) =>
                $q->whereNotNull('email_verified_at')
            )
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 25));

        return response()->json($users);
    }

    /**
     * GET /api/v1/platform/users/{user}
     * Full user detail for platform review.
     * Excludes password_hash — never exposed.
     */
    public function show(User $user): JsonResponse
    {
        $user->load(['organizationUsers.organization', 'leader']);

        return response()->json([
            'id'                => $user->id,
            'first_name'        => $user->first_name,
            'last_name'         => $user->last_name,
            'email'             => $user->email,
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
            'is_active'         => $user->is_active,
            'created_at'        => $user->created_at?->toIso8601String(),
            'organizations'     => $user->organizationUsers->map(fn ($ou) => [
                'organization_id'   => $ou->organization_id,
                'organization_name' => $ou->organization?->name,
                'role'              => $ou->role,
                'is_active'         => $ou->is_active,
            ]),
            'has_leader_profile' => $user->leader !== null,
        ]);
    }
}
