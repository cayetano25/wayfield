<?php

declare(strict_types=1);

namespace App\Http\Controllers\Platform\V1;

use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use App\Services\Platform\TwoFactorAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\PlatformConfig;

class TwoFactorChallengeController extends Controller
{
    public function __construct(private readonly TwoFactorAuthService $tfaService) {}

    // ─── POST /api/platform/v1/auth/two-factor ────────────────────────────────

    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'two_factor_session_token' => ['required', 'string'],
            'code'                     => ['required', 'string', 'digits:6'],
        ]);

        $session = $this->tfaService->resolveSessionToken($request->two_factor_session_token);
        if (! $session) {
            return response()->json([
                'message' => 'Invalid or expired session. Please log in again.',
            ], 422);
        }

        $admin = AdminUser::find($session['admin_id']);
        if (! $admin || ! $admin->is_active) {
            return response()->json(['message' => 'Account not found.'], 422);
        }

        if ($session['attempts'] >= TwoFactorAuthService::MAX_ATTEMPTS) {
            $this->tfaService->invalidateSessionToken($request->two_factor_session_token);
            return response()->json([
                'message' => 'Too many failed attempts. Please log in again.',
            ], 422);
        }

        if (! $this->tfaService->verifyCodeForAdmin($admin, $request->code)) {
            $attempts   = $this->tfaService->incrementAttempts($request->two_factor_session_token);
            $remaining  = TwoFactorAuthService::MAX_ATTEMPTS - $attempts;

            if ($remaining <= 0) {
                $this->tfaService->invalidateSessionToken($request->two_factor_session_token);
                return response()->json([
                    'message'           => 'Too many failed attempts. Please log in again.',
                    'attempts_remaining' => 0,
                ], 422);
            }

            return response()->json([
                'message'            => 'Invalid code.',
                'attempts_remaining' => $remaining,
            ], 422);
        }

        return $this->issueToken($admin, $request->two_factor_session_token);
    }

    // ─── POST /api/platform/v1/auth/two-factor/recovery ──────────────────────

    public function recovery(Request $request): JsonResponse
    {
        $request->validate([
            'two_factor_session_token' => ['required', 'string'],
            'recovery_code'            => ['required', 'string'],
        ]);

        $session = $this->tfaService->resolveSessionToken($request->two_factor_session_token);
        if (! $session) {
            return response()->json([
                'message' => 'Invalid or expired session. Please log in again.',
            ], 422);
        }

        $admin = AdminUser::find($session['admin_id']);
        if (! $admin || ! $admin->is_active) {
            return response()->json(['message' => 'Account not found.'], 422);
        }

        if (! $admin->consumeRecoveryCode($request->recovery_code)) {
            return response()->json(['message' => 'Invalid recovery code.'], 422);
        }

        $response = $this->issueToken($admin, $request->two_factor_session_token);

        // Warn if recovery codes are now exhausted so the frontend can prompt regeneration.
        if (empty($admin->fresh()->validRecoveryCodes())) {
            $data = $response->getData(true);
            $data['recovery_codes_exhausted'] = true;
            return response()->json($data);
        }

        return $response;
    }

    // ─── Shared token issuance ────────────────────────────────────────────────

    private function issueToken(AdminUser $admin, string $sessionToken): JsonResponse
    {
        $this->tfaService->invalidateSessionToken($sessionToken);

        $sessionHours = (int) PlatformConfig::get('platform_admin_session_timeout_hours', 8);
        $token = $admin->createToken('platform_token', ['platform:*'], now()->addHours($sessionHours));

        $admin->update(['last_login_at' => now()]);

        return response()->json([
            'token' => $token->plainTextToken,
            'admin_user' => [
                'id'         => $admin->id,
                'first_name' => $admin->first_name,
                'last_name'  => $admin->last_name,
                'email'      => $admin->email,
                'role'       => $admin->role,
            ],
        ]);
    }
}
