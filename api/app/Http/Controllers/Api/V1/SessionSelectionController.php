<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Sessions\Actions\DeselectSessionAction;
use App\Domain\Sessions\Actions\SelectSessionAction;
use App\Domain\Sessions\Exceptions\SessionCapacityExceededException;
use App\Domain\Sessions\Exceptions\SessionConflictException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\SelectSessionRequest;
use App\Http\Resources\ParticipantSessionResource;
use App\Http\Resources\SessionSelectionResource;
use App\Models\Registration;
use App\Models\Session;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class SessionSelectionController extends Controller
{
    /**
     * GET /api/v1/workshops/{workshop}/selection-options
     * Return selectable sessions with availability context for a registered participant.
     */
    public function options(Workshop $workshop): JsonResponse
    {
        $user = Auth::user();

        $registration = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->where('registration_status', 'registered')
            ->first();

        if (! $registration) {
            return response()->json(['message' => 'You are not registered for this workshop.'], 403);
        }

        $sessions = Session::where('workshop_id', $workshop->id)
            ->where('is_published', true)
            ->with(['track', 'location'])
            ->orderBy('start_at')
            ->get();

        $selectedIds = $registration->selections()
            ->where('selection_status', 'selected')
            ->pluck('session_id')
            ->toArray();

        $result = $sessions->map(function (Session $session) use ($selectedIds) {
            $confirmedCount = $session->confirmedSelectionCount();
            $available = $session->hasUnlimitedCapacity()
                ? null
                : max(0, $session->capacity - $confirmedCount);

            return [
                'session' => new ParticipantSessionResource($session),
                'is_selected' => in_array($session->id, $selectedIds),
                'capacity' => $session->capacity,
                'confirmed_count' => $confirmedCount,
                'available_slots' => $available,
                'is_full' => ! $session->hasUnlimitedCapacity() && $available === 0,
            ];
        });

        return response()->json($result);
    }

    /**
     * POST /api/v1/workshops/{workshop}/selections
     */
    public function store(
        SelectSessionRequest $request,
        Workshop $workshop,
        SelectSessionAction $action,
    ): JsonResponse {
        $user = Auth::user();

        $registration = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->where('registration_status', 'registered')
            ->first();

        if (! $registration) {
            return response()->json(['message' => 'You are not registered for this workshop.'], 403);
        }

        $session = Session::find($request->validated('session_id'));

        if (! $session || $session->workshop_id !== $workshop->id) {
            return response()->json(['message' => 'Session not found in this workshop.'], 404);
        }

        try {
            $selection = $action->execute($registration, $session);
        } catch (SessionCapacityExceededException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (SessionConflictException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(
            new SessionSelectionResource($selection->load('session')),
            201
        );
    }

    /**
     * DELETE /api/v1/workshops/{workshop}/selections/{session}
     */
    public function destroy(
        Workshop $workshop,
        Session $session,
        DeselectSessionAction $action,
    ): JsonResponse {
        $user = Auth::user();

        $registration = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->where('registration_status', 'registered')
            ->first();

        if (! $registration) {
            return response()->json(['message' => 'You are not registered for this workshop.'], 403);
        }

        $action->execute($registration, $session);

        return response()->json(null, 204);
    }
}
