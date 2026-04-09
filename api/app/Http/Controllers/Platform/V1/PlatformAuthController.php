<?php

namespace App\Http\Controllers\Platform\V1;

use App\Http\Controllers\Controller;
use App\Models\AdminLoginEvent;
use App\Models\AdminUser;
use App\Models\PlatformConfig;
use App\Models\SecurityEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class PlatformAuthController extends Controller
{
    // ─── POST /api/platform/v1/auth/login ─────────────────────────────────────

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $adminUser = AdminUser::where('email', $data['email'])->first();

        // ── Failed authentication ────────────────────────────────────────────
        if (! $adminUser || ! Hash::check($data['password'], $adminUser->password_hash)) {
            AdminLoginEvent::create([
                'admin_user_id' => $adminUser?->id,
                'email_attempted' => $data['email'],
                'outcome' => 'failed',
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            $this->checkBruteForce($request);

            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ])->status(401);
        }

        if (! $adminUser->is_active) {
            AdminLoginEvent::create([
                'admin_user_id' => $adminUser->id,
                'email_attempted' => $data['email'],
                'outcome' => 'locked',
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            throw ValidationException::withMessages([
                'email' => ['Account is inactive.'],
            ])->status(403);
        }

        // ── Successful authentication ────────────────────────────────────────
        $sessionHours = (int) PlatformConfig::get('platform_admin_session_timeout_hours', 8);
        $token = $adminUser->createToken('platform_token', ['platform:*'], now()->addHours($sessionHours));

        $adminUser->update(['last_login_at' => now()]);

        AdminLoginEvent::create([
            'admin_user_id' => $adminUser->id,
            'email_attempted' => $data['email'],
            'outcome' => 'success',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'token' => $token->plainTextToken,
            'admin_user' => [
                'id' => $adminUser->id,
                'first_name' => $adminUser->first_name,
                'last_name' => $adminUser->last_name,
                'email' => $adminUser->email,
                'role' => $adminUser->role,
            ],
        ]);
    }

    // ─── POST /api/platform/v1/auth/logout ────────────────────────────────────

    public function logout(Request $request): JsonResponse
    {
        $request->user('platform_admin')->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    // ─── GET /api/platform/v1/auth/me ─────────────────────────────────────────

    public function me(Request $request): JsonResponse
    {
        /** @var AdminUser $adminUser */
        $adminUser = $request->user('platform_admin');

        return response()->json([
            'id' => $adminUser->id,
            'first_name' => $adminUser->first_name,
            'last_name' => $adminUser->last_name,
            'email' => $adminUser->email,
            'role' => $adminUser->role,
            'is_active' => $adminUser->is_active,
            'can_impersonate' => $adminUser->can_impersonate,
            'last_login_at' => $adminUser->last_login_at,
        ]);
    }

    // ─── Brute-force detection ─────────────────────────────────────────────────

    /**
     * Count recent failed attempts from this IP and raise a security_event
     * if the brute-force threshold from platform_config is exceeded.
     */
    private function checkBruteForce(Request $request): void
    {
        $threshold = (int) PlatformConfig::get('security_brute_force_threshold', 10);
        $ip = $request->ip();

        $recentFailures = AdminLoginEvent::where('ip_address', $ip)
            ->where('outcome', 'failed')
            ->where('created_at', '>=', now()->subMinutes(15))
            ->count();

        if ($recentFailures >= $threshold) {
            SecurityEvent::create([
                'event_type' => 'brute_force_attempt',
                'severity' => 'high',
                'ip_address' => $ip,
                'description' => "Platform admin brute-force detected: {$recentFailures} failed attempts in 15 minutes from IP {$ip}.",
                'metadata_json' => [
                    'failure_count' => $recentFailures,
                    'window_minutes' => 15,
                    'threshold' => $threshold,
                ],
                'is_resolved' => false,
            ]);
        }
    }
}
