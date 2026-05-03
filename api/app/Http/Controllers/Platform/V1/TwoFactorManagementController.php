<?php

declare(strict_types=1);

namespace App\Http\Controllers\Platform\V1;

use App\Domain\Platform\Services\PlatformAuditService;
use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use App\Services\Platform\TwoFactorAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class TwoFactorManagementController extends Controller
{
    public function __construct(
        private readonly TwoFactorAuthService $tfaService,
        private readonly PlatformAuditService $audit,
    ) {}

    // ─── GET /api/platform/v1/auth/two-factor/setup ──────────────────────────

    public function setup(Request $request): JsonResponse
    {
        /** @var AdminUser $admin */
        $admin = $request->user('platform_admin');

        if ($admin->hasTwoFactorEnabled()) {
            return response()->json(['already_configured' => true]);
        }

        $secret = $this->tfaService->generateSecret();
        $admin->forceFill(['two_factor_secret' => $secret])->save();

        return response()->json([
            'secret'            => $secret,
            'qr_code_svg'       => $this->tfaService->getQrCodeSvg($admin, $secret),
            'already_configured' => false,
        ]);
    }

    // ─── POST /api/platform/v1/auth/two-factor/confirm ───────────────────────

    public function confirm(Request $request): JsonResponse
    {
        $request->validate(['code' => ['required', 'string', 'digits:6']]);

        /** @var AdminUser $admin */
        $admin = $request->user('platform_admin');

        if (! $admin->two_factor_secret) {
            return response()->json(['message' => 'Run /setup first.'], 422);
        }

        if ($admin->hasTwoFactorEnabled()) {
            return response()->json(['message' => '2FA is already configured.'], 422);
        }

        if (! $this->tfaService->verifyCode($admin->two_factor_secret, $request->code)) {
            return response()->json(['message' => 'Invalid code. Please try again.'], 422);
        }

        $plainCodes  = $this->tfaService->generateRecoveryCodes();
        $hashedCodes = $this->tfaService->hashRecoveryCodes($plainCodes);

        $admin->forceFill([
            'two_factor_confirmed_at'   => now(),
            'two_factor_recovery_codes' => $hashedCodes,
        ])->save();

        $this->audit->record(
            action: 'two_factor.enabled',
            adminUser: $admin,
            options: ['entity_type' => 'admin_user', 'entity_id' => $admin->id],
        );

        return response()->json([
            'confirmed'      => true,
            'recovery_codes' => $plainCodes,
        ]);
    }

    // ─── POST /api/platform/v1/auth/two-factor/disable ───────────────────────

    public function disable(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'string'],
            'code'     => ['sometimes', 'string', 'digits:6'],
            'recovery_code' => ['sometimes', 'string'],
        ]);

        /** @var AdminUser $admin */
        $admin = $request->user('platform_admin');

        if (! Hash::check($request->password, $admin->password_hash)) {
            return response()->json(['message' => 'Incorrect password.'], 422);
        }

        $verified = false;
        if ($request->filled('code')) {
            $verified = $this->tfaService->verifyCodeForAdmin($admin, $request->code);
        } elseif ($request->filled('recovery_code')) {
            $verified = $admin->consumeRecoveryCode($request->recovery_code);
        }

        if (! $verified) {
            return response()->json(['message' => 'Could not verify identity. Provide a valid TOTP code or recovery code.'], 422);
        }

        $admin->forceFill([
            'two_factor_secret'         => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at'   => null,
        ])->save();

        $this->audit->record(
            action: 'two_factor.disabled',
            adminUser: $admin,
            options: ['entity_type' => 'admin_user', 'entity_id' => $admin->id],
        );

        return response()->json(['disabled' => true]);
    }

    // ─── POST /api/platform/v1/auth/two-factor/recovery-codes/regenerate ─────

    public function regenerateRecoveryCodes(Request $request): JsonResponse
    {
        $request->validate(['code' => ['required', 'string', 'digits:6']]);

        /** @var AdminUser $admin */
        $admin = $request->user('platform_admin');

        if (! $this->tfaService->verifyCodeForAdmin($admin, $request->code)) {
            return response()->json(['message' => 'Invalid code.'], 422);
        }

        $plainCodes = $this->tfaService->generateRecoveryCodes();
        $admin->forceFill([
            'two_factor_recovery_codes' => $this->tfaService->hashRecoveryCodes($plainCodes),
        ])->save();

        $this->audit->record(
            action: 'two_factor.recovery_codes_regenerated',
            adminUser: $admin,
            options: ['entity_type' => 'admin_user', 'entity_id' => $admin->id],
        );

        return response()->json(['recovery_codes' => $plainCodes]);
    }

    // ─── POST /api/platform/v1/admins/{id}/two-factor/disable ────────────────

    public function disableForAdmin(Request $request, int $id): JsonResponse
    {
        /** @var AdminUser $actor */
        $actor = $request->user('platform_admin');

        if ($actor->role !== 'super_admin') {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        if ($id === $actor->id) {
            return response()->json([
                'message' => 'Use the self-service disable endpoint to remove your own 2FA.',
            ], 403);
        }

        $target = AdminUser::findOrFail($id);

        $target->forceFill([
            'two_factor_secret'         => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at'   => null,
        ])->save();

        $this->audit->record(
            action: 'two_factor.disabled_by_admin',
            adminUser: $actor,
            options: [
                'entity_type'   => 'admin_user',
                'entity_id'     => $target->id,
                'metadata_json' => ['disabled_for' => $target->email],
            ],
        );

        return response()->json(['disabled' => true]);
    }
}
