<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Auth\Actions\CompleteOnboardingAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\CompleteOnboardingRequest;
use App\Http\Requests\Api\V1\Auth\UpdateProfileRequest;
use App\Services\Address\AddressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OnboardingController extends Controller
{
    /**
     * GET /api/v1/onboarding/status
     *
     * Returns the current user's onboarding state.
     * Used by the frontend to resume at the correct step on page refresh.
     */
    public function status(Request $request, AddressService $addressService): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing('profile.address');

        return response()->json([
            'onboarding_completed' => $user->hasCompletedOnboarding(),
            'steps' => [
                'account_basics' => true,   // always done if the user record exists
                'profile' => $user->pronouns !== null
                    || $user->profile?->address_id !== null,
                'intent' => $user->hasCompletedOnboarding(),
            ],
            'user' => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'pronouns' => $user->pronouns,
                'profile' => $user->profile ? [
                    'phone_number' => $user->profile->phone_number,
                    'timezone' => $user->profile->timezone,
                    'address' => $user->profile->address
                        ? $addressService->toApiResponse($user->profile->address)
                        : null,
                ] : null,
            ],
        ]);
    }

    /**
     * PATCH /api/v1/onboarding/profile
     *
     * Updates pronouns, phone, timezone, and optional address.
     * All fields optional. Never blocks progression to the next step.
     */
    public function updateProfile(
        UpdateProfileRequest $request,
        AddressService $addressService
    ): JsonResponse {
        $user = $request->user();
        $data = $request->validated();

        if (array_key_exists('pronouns', $data)) {
            $user->update(['pronouns' => $data['pronouns']]);
        }

        // Ensure a profile row exists before updating it.
        $profile = $user->profile ?? $user->profile()->create(['user_id' => $user->id]);

        if (array_key_exists('phone_number', $data)) {
            $profile->update(['phone_number' => $data['phone_number']]);
        }

        if (array_key_exists('timezone', $data)) {
            $profile->update(['timezone' => $data['timezone']]);
        }

        if (! empty($data['address'])) {
            if ($profile->address_id) {
                $profile->loadMissing('address');
                $addressService->updateFromRequest($profile->address, $data['address']);
            } else {
                $address = $addressService->createFromRequest($data['address']);
                $profile->update(['address_id' => $address->id]);
            }
        }

        return response()->json([
            'message' => 'Profile updated.',
            'user' => $user->fresh(['profile.address']),
        ]);
    }

    /**
     * POST /api/v1/onboarding/complete
     *
     * Processes the intent selection and performs the first contextual action.
     * Sets onboarding_completed_at regardless of intent outcome.
     */
    public function complete(
        CompleteOnboardingRequest $request,
        CompleteOnboardingAction $action
    ): JsonResponse {
        $result = $action->execute($request->user(), $request->validated());

        return response()->json([
            'message' => $result['message'],
            'redirect' => $result['redirect'],
        ]);
    }
}
