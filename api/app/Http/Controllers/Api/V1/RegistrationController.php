<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Subscriptions\Exceptions\PlanLimitExceededException;
use App\Domain\Subscriptions\Services\EnforceFeatureGateService;
use App\Domain\Webhooks\WebhookDispatcher;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\JoinWorkshopRequest;
use App\Http\Resources\RegistrationResource;
use App\Mail\WorkshopJoinConfirmationMail;
use App\Models\Registration;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class RegistrationController extends Controller
{
    public function __construct(
        private readonly EnforceFeatureGateService $featureGate,
        private readonly WebhookDispatcher $webhookDispatcher,
    ) {}

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

        // Only enforce participant limit on brand-new registrations (not re-activations).
        // We load the org via the workshop to get the correct plan limits.
        $existingCheck = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $existingCheck) {
            try {
                $this->featureGate->assertCanAddParticipant(
                    $workshop->organization,
                    $workshop,
                );
            } catch (PlanLimitExceededException $e) {
                return response()->json([
                    'error'         => 'plan_limit_exceeded',
                    'message'       => $e->getMessage(),
                    'limit_key'     => $e->limitKey,
                    'current'       => $e->current,
                    'max'           => $e->max,
                    'required_plan' => $e->requiredPlan,
                ], 403);
            }
        }

        $existing = $existingCheck;

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

        Mail::to($user->email)->queue(new WorkshopJoinConfirmationMail($user, $workshop, $registration));

        // Dispatch webhook event — failure must NOT fail the primary action.
        try {
            $this->webhookDispatcher->dispatch('participant.registered', $workshop->organization_id, [
                'registration_id' => $registration->id,
                'workshop_id'     => $workshop->id,
                'workshop_title'  => $workshop->title,
                'user_id'         => $user->id,
                'first_name'      => $user->first_name,
                'last_name'       => $user->last_name,
                'registered_at'   => $registration->registered_at?->toIso8601String(),
                'joined_via_code' => $registration->joined_via_code !== null,
            ]);
        } catch (\Throwable $e) {
            Log::warning('RegistrationController: webhook dispatch failed', [
                'registration_id' => $registration->id,
                'error'           => $e->getMessage(),
            ]);
        }

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
