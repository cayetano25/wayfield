<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Attendance\Actions\LeaderCheckInAction;
use App\Domain\Attendance\Actions\MarkNoShowAction;
use App\Domain\Attendance\Actions\SelfCheckInAction;
use App\Domain\Attendance\Exceptions\AttendanceEligibilityException;
use App\Http\Controllers\Controller;
use App\Models\Session;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function __construct(
        private readonly SelfCheckInAction $selfCheckIn,
        private readonly LeaderCheckInAction $leaderCheckIn,
        private readonly MarkNoShowAction $markNoShow,
    ) {}

    /**
     * POST /api/v1/sessions/{session}/check-in
     * Participant self-check-in.
     */
    public function selfCheckIn(Request $request, Session $session): JsonResponse
    {
        $user = $request->user();

        $this->authorize('attendance.self-check-in', $session);

        try {
            $record = $this->selfCheckIn->execute($user, $session);
        } catch (AttendanceEligibilityException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Checked in successfully.',
            'status' => $record->status,
        ]);
    }

    /**
     * POST /api/v1/sessions/{session}/attendance/{user}/leader-check-in
     * Assigned leader manually checks in a participant.
     */
    public function leaderCheckIn(Request $request, Session $session, User $user): JsonResponse
    {
        $leaderUser = $request->user();

        $this->authorize('attendance.leader-manage', $session);

        $record = $this->leaderCheckIn->execute($leaderUser, $session, $user);

        return response()->json([
            'message' => 'Participant checked in.',
            'status' => $record->status,
        ]);
    }

    /**
     * POST /api/v1/sessions/{session}/attendance/{user}/no-show
     * Assigned leader marks a participant as no-show.
     */
    public function markNoShow(Request $request, Session $session, User $user): JsonResponse
    {
        $leaderUser = $request->user();

        $this->authorize('attendance.leader-manage', $session);

        $record = $this->markNoShow->execute($leaderUser, $session, $user);

        return response()->json([
            'message' => 'Participant marked as no-show.',
            'status' => $record->status,
        ]);
    }
}
