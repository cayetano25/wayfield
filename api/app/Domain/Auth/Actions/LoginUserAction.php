<?php

namespace App\Domain\Auth\Actions;

use App\Models\User;
use App\Models\UserSession;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Support\Facades\Hash;

class LoginUserAction
{
    /**
     * @throws AuthenticationException
     */
    public function execute(array $data): array
    {
        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password_hash)) {
            throw new AuthenticationException('Invalid credentials.');
        }

        if (! $user->is_active) {
            throw new AuthenticationException('Account is inactive.');
        }

        $platform = $data['platform'] ?? 'unknown';

        $token = $user->createToken('auth_token', ['*'], now()->addDays(30));

        $user->update(['last_login_at' => now()]);

        UserSession::updateOrCreate(
            [
                'user_id'            => $user->id,
                'session_token_hash' => hash('sha256', $token->plainTextToken),
            ],
            [
                'platform'     => $platform,
                'device_name'  => $data['device_name'] ?? null,
                'last_seen_at' => now(),
                'expires_at'   => now()->addDays(30),
            ]
        );

        return [
            'token' => $token->plainTextToken,
            'user'  => $user,
        ];
    }
}
