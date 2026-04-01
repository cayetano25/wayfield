<?php

namespace App\Domain\Auth\Actions;

use App\Mail\PasswordResetMail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class RequestPasswordResetAction
{
    public function execute(string $email): void
    {
        $user = User::where('email', $email)->first();

        // Always return success to prevent email enumeration.
        if (! $user) {
            return;
        }

        $token = Str::random(64);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $email],
            [
                'token_hash' => hash('sha256', $token),
                'expires_at' => now()->addHour()->toDateTimeString(),
                'created_at' => now()->toDateTimeString(),
            ]
        );

        Mail::to($user->email)->queue(new PasswordResetMail($user, $token));
    }
}
