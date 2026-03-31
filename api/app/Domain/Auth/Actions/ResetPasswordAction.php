<?php

namespace App\Domain\Auth\Actions;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ResetPasswordAction
{
    /**
     * @throws ValidationException
     */
    public function execute(array $data): void
    {
        $record = DB::table('password_reset_tokens')
            ->where('email', $data['email'])
            ->first();

        if (! $record) {
            throw ValidationException::withMessages([
                'token' => ['This password reset token is invalid.'],
            ]);
        }

        if (! hash_equals($record->token_hash, hash('sha256', $data['token']))) {
            throw ValidationException::withMessages([
                'token' => ['This password reset token is invalid.'],
            ]);
        }

        if (now()->isAfter($record->expires_at)) {
            throw ValidationException::withMessages([
                'token' => ['This password reset token has expired.'],
            ]);
        }

        $user = User::where('email', $data['email'])->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'email' => ['No account found for this email address.'],
            ]);
        }

        $user->update(['password_hash' => Hash::make($data['password'])]);

        // Revoke all tokens after password reset for security.
        $user->tokens()->delete();

        DB::table('password_reset_tokens')->where('email', $data['email'])->delete();
    }
}
