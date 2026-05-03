<?php

declare(strict_types=1);

namespace App\Services\Platform;

use App\Models\AdminUser;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorAuthService
{
    public const MAX_ATTEMPTS = 5;

    private Google2FA $engine;

    public function __construct()
    {
        $this->engine = new Google2FA();
    }

    // ─── Secret generation ────────────────────────────────────────────────────

    public function generateSecret(): string
    {
        return $this->engine->generateSecretKey();
    }

    public function getQrCodeUrl(AdminUser $admin, string $secret): string
    {
        return $this->engine->getQRCodeUrl(
            config('app.name', 'Wayfield'),
            $admin->email,
            $secret
        );
    }

    public function getQrCodeSvg(AdminUser $admin, string $secret): string
    {
        $url = $this->getQrCodeUrl($admin, $secret);

        $renderer = new ImageRenderer(
            new RendererStyle(200),
            new SvgImageBackEnd()
        );

        return (new Writer($renderer))->writeString($url);
    }

    // ─── TOTP verification ────────────────────────────────────────────────────

    public function verifyCode(string $secret, string $code): bool
    {
        // Allow ±1 window of drift (±30 seconds) to tolerate clock skew.
        return (bool) $this->engine->verifyKey($secret, $code, 1);
    }

    public function verifyCodeForAdmin(AdminUser $admin, string $code): bool
    {
        if (! $admin->two_factor_secret) {
            return false;
        }
        return $this->verifyCode($admin->two_factor_secret, $code);
    }

    // ─── Recovery codes ───────────────────────────────────────────────────────

    public function generateRecoveryCodes(): array
    {
        return array_map(
            fn () => strtoupper(Str::random(5)) . '-' . strtoupper(Str::random(5)),
            range(1, 8)
        );
    }

    public function hashRecoveryCodes(array $plainCodes): array
    {
        return array_map(fn ($code) => Hash::make($code), $plainCodes);
    }

    // ─── Session token (intermediate — between login and TOTP verify) ─────────

    public function createSessionToken(AdminUser $admin): string
    {
        $token = Str::uuid()->toString();
        Cache::put(
            "2fa_session:{$token}",
            ['admin_id' => $admin->id, 'attempts' => 0],
            now()->addMinutes(10)
        );
        return $token;
    }

    public function resolveSessionToken(string $token): ?array
    {
        return Cache::get("2fa_session:{$token}");
    }

    public function incrementAttempts(string $token): int
    {
        $data = Cache::get("2fa_session:{$token}");
        if (! $data) {
            return 0;
        }
        $data['attempts']++;
        Cache::put("2fa_session:{$token}", $data, now()->addMinutes(10));
        return $data['attempts'];
    }

    public function invalidateSessionToken(string $token): void
    {
        Cache::forget("2fa_session:{$token}");
    }
}
