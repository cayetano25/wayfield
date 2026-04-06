<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

class OnboardingController extends Controller
{
    public function complete(Request $request): UserResource
    {
        $user = $request->user();

        $user->update(['onboarding_completed_at' => now()]);

        return new UserResource($user->fresh());
    }
}
