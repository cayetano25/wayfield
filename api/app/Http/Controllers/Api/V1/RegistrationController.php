<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\JoinWorkshopRequest;
use App\Http\Resources\RegistrationResource;
use App\Models\Registration;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class RegistrationController extends Controller
{
    /**
     * POST /api/v1/workshops/join
     * Join a workshop by join code.
     */
    public function join(JoinWorkshopRequest $request): JsonResponse
    {
        $workshop = Workshop::where('join_code', strtoupper($request->validated('join_code')))
            ->where('status', 'published')
            ->first();

        if (! $workshop) {
            return response()->json(['message' => 'Invalid or expired join code.'], 404);
        }

        $user = Auth::user();

        $existing = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            if ($existing->registration_status === 'registered') {
                return response()->json(new RegistrationResource($existing), 200);
            }

            // Re-activate a previously canceled registration.
            $existing->update([
                'registration_status' => 'registered',
                'canceled_at'         => null,
                'joined_via_code'     => $request->validated('join_code'),
            ]);

            return response()->json(new RegistrationResource($existing->fresh()), 200);
        }

        $registration = Registration::create([
            'workshop_id'         => $workshop->id,
            'user_id'             => $user->id,
            'registration_status' => 'registered',
            'joined_via_code'     => $request->validated('join_code'),
            'registered_at'       => now(),
        ]);

        return response()->json(new RegistrationResource($registration), 201);
    }

    /**
     * GET /api/v1/workshops/{workshop}/registration
     */
    public function show(Workshop $workshop): JsonResponse
    {
        $user = Auth::user();

        $registration = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $registration) {
            return response()->json(['message' => 'Not registered for this workshop.'], 404);
        }

        return response()->json(new RegistrationResource($registration));
    }

    /**
     * DELETE /api/v1/workshops/{workshop}/registration
     */
    public function cancel(Workshop $workshop): JsonResponse
    {
        $user = Auth::user();

        $registration = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->where('registration_status', 'registered')
            ->first();

        if (! $registration) {
            return response()->json(['message' => 'No active registration found.'], 404);
        }

        $registration->update([
            'registration_status' => 'canceled',
            'canceled_at'         => now(),
        ]);

        return response()->json(null, 204);
    }
}
