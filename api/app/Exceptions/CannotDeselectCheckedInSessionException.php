<?php

namespace App\Exceptions;

use RuntimeException;

class CannotDeselectCheckedInSessionException extends RuntimeException
{
    public function render(): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
        ], 422);
    }
}
