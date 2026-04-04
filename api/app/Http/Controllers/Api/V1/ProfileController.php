<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProfileController extends Controller
{
    public function show(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function update(UpdateProfileRequest $request): UserResource
    {
        $request->user()->update($request->validated());

        return new UserResource($request->user()->fresh());
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
                    'id'        => $membership->organization->id,
                    'name'      => $membership->organization->name,
                    'slug'      => $membership->organization->slug,
                    'role'      => $membership->role,
                    'status'    => $membership->organization->status,
                    'plan_code' => $membership->organization->subscription?->plan_code ?? 'free',
                ];
            })->values()
        );
    }
}
