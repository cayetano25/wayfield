<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PlatformUserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = User::query()
            ->withCount('organizationUsers')
            ->when($request->input('search'), fn ($q, $search) => $q->where(fn ($q) => $q
                ->where('first_name', 'like', "%{$search}%")
                ->orWhere('last_name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
            ))
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 25));

        $users->getCollection()->transform(fn (User $u) => [
            'id'                  => $u->id,
            'first_name'          => $u->first_name,
            'last_name'           => $u->last_name,
            'email'               => $u->email,
            'is_active'           => $u->is_active,
            'email_verified_at'   => $u->email_verified_at?->toIso8601String(),
            'last_login_at'       => $u->last_login_at?->toIso8601String(),
            'created_at'          => $u->created_at?->toIso8601String(),
            'organization_count'  => $u->organization_users_count,
        ]);

        return response()->json($users);
    }

    public function show(User $user): JsonResponse
    {
        $user->load(['organizationUsers.organization']);

        $loginHistory = DB::table('login_events')
            ->where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get(['ip_address', 'user_agent', 'outcome', 'created_at']);

        return response()->json([
            'id'                => $user->id,
            'first_name'        => $user->first_name,
            'last_name'         => $user->last_name,
            'email'             => $user->email,
            'is_active'         => $user->is_active,
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
            'last_login_at'     => $user->last_login_at?->toIso8601String(),
            'created_at'        => $user->created_at?->toIso8601String(),
            'organizations'     => $user->organizationUsers->map(fn ($ou) => [
                'id'        => $ou->organization_id,
                'name'      => $ou->organization?->name,
                'role'      => $ou->role,
                'joined_at' => $ou->created_at?->toIso8601String(),
            ]),
            'login_history'     => $loginHistory,
        ]);
    }
}
