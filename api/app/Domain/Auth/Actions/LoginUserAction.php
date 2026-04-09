<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Auth\Services\RecordLoginEventService;
use App\Models\User;
use App\Models\UserSession;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class LoginUserAction
{
    public function __construct(
        private readonly RecordLoginEventService $loginEventService,
    ) {}

    /**
     * @throws AuthenticationException
     */
    public function execute(array $data, ?Request $request = null): array
    {
        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password_hash)) {
            $this->loginEventService->record(
                user: $user,
                outcome: 'failed',
                request: $request,
                emailAttempted: $data['email'],
            );
            throw new AuthenticationException('Invalid credentials.');
        }

        if (! $user->is_active) {
            $this->loginEventService->record(
                user: $user,
                outcome: 'inactive',
                request: $request,
                emailAttempted: $data['email'],
            );
            throw new AuthenticationException('Account is inactive.');
        }

        if (! $user->email_verified_at) {
            $this->loginEventService->record(
                user: $user,
                outcome: 'unverified',
                request: $request,
                emailAttempted: $data['email'],
            );
            throw new AuthenticationException('Email address has not been verified.');
        }

        $platform = $data['platform'] ?? 'unknown';

        $token = $user->createToken('auth_token', ['*'], now()->addDays(30));

        $user->update(['last_login_at' => now()]);

        UserSession::updateOrCreate(
            [
                'user_id' => $user->id,
                'session_token_hash' => hash('sha256', $token->plainTextToken),
            ],
            [
                'platform' => $platform,
                'device_name' => $data['device_name'] ?? null,
                'last_seen_at' => now(),
                'expires_at' => now()->addDays(30),
            ]
        );

        $this->loginEventService->record(
            user: $user,
            outcome: 'success',
            request: $request,
            emailAttempted: $data['email'],
        );

        return [
            'token' => $token->plainTextToken,
            'user' => $user,
        ];
    }
}
