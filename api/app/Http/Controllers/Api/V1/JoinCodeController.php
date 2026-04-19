<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Workshops\Actions\RotateJoinCodeAction;
use App\Http\Controllers\Controller;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;

class JoinCodeController extends Controller
{
    /**
     * POST /api/v1/workshops/{workshop}/rotate-join-code
     *
     * Generate a new join code for the workshop, immediately invalidating the old one.
     * Existing registered participants are unaffected — only future join attempts change.
     * Requires owner or admin role.
     */
    public function rotate(Workshop $workshop, RotateJoinCodeAction $action): JsonResponse
    {
        $this->authorize('rotateJoinCode', $workshop);

        $newCode = $action->execute($workshop, request()->user());

        return response()->json(['join_code' => $newCode]);
    }
}
