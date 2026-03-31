<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateProfileRequest;
use App\Http\Resources\OrganizationResource;
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

    public function organizations(Request $request): AnonymousResourceCollection
    {
        $organizations = $request->user()
            ->organizations()
            ->wherePivot('is_active', true)
            ->get();

        return OrganizationResource::collection($organizations);
    }
}
