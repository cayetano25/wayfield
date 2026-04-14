<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

class CannotDeselectCheckedInSessionException extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json([
            'error' => 'already_checked_in',
            'message' => $this->getMessage(),
        ], 422);
    }
}
