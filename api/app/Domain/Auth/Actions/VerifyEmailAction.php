<?php

namespace App\Domain\Auth\Actions;

use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

class VerifyEmailAction
{
    /**
     * @throws AuthorizationException
     */
    public function execute(User $user, string $hash): void
    {
        if (! hash_equals(sha1($user->email), $hash)) {
            throw new AuthorizationException('Invalid verification link.');
        }

        if ($user->hasVerifiedEmail()) {
            return;
        }

        $user->update(['email_verified_at' => now()]);
    }
}
