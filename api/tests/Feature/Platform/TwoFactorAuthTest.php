<?php

use App\Models\AdminUser;
use App\Models\PlatformAuditLog;
use App\Services\Platform\TwoFactorAuthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function make2faAdmin(array $overrides = []): AdminUser
{
    return AdminUser::create(array_merge([
        'first_name'   => 'Platform',
        'last_name'    => 'Admin',
        'email'        => 'admin@wayfield.internal',
        'password_hash' => Hash::make('secure-password'),
        'role'         => 'admin',
        'is_active'    => true,
    ], $overrides));
}

function adminWithTwoFactor(array $overrides = []): array
{
    $tfaService = app(TwoFactorAuthService::class);
    $secret     = $tfaService->generateSecret();
    $plainCodes = $tfaService->generateRecoveryCodes();

    $admin = make2faAdmin(array_merge([
        'two_factor_secret'         => $secret,
        'two_factor_confirmed_at'   => now(),
        'two_factor_recovery_codes' => $tfaService->hashRecoveryCodes($plainCodes),
    ], $overrides));

    return [$admin, $secret, $plainCodes];
}

function validTotpCode(string $secret): string
{
    return (new Google2FA())->getCurrentOtp($secret);
}

function platformToken(AdminUser $admin): string
{
    return $admin->createToken('platform_token', ['platform:*'])->plainTextToken;
}

// ─── Login flow ───────────────────────────────────────────────────────────────

test('login with valid credentials and no 2FA configured returns token immediately', function () {
    make2faAdmin();

    $response = $this->postJson('/api/platform/v1/auth/login', [
        'email'    => 'admin@wayfield.internal',
        'password' => 'secure-password',
    ]);

    $response->assertOk()
        ->assertJsonPath('requires_2fa', false)
        ->assertJsonPath('two_factor_configured', false)
        ->assertJsonStructure(['token', 'admin_user' => ['id', 'email', 'role']]);
});

test('login with valid credentials and 2FA enabled returns session token not a full token', function () {
    adminWithTwoFactor();

    $response = $this->postJson('/api/platform/v1/auth/login', [
        'email'    => 'admin@wayfield.internal',
        'password' => 'secure-password',
    ]);

    $response->assertOk()
        ->assertJsonPath('requires_2fa', true)
        ->assertJsonStructure(['two_factor_session_token'])
        ->assertJsonMissingPath('token');
});

test('login with invalid credentials returns 401 and no session token', function () {
    make2faAdmin();

    $response = $this->postJson('/api/platform/v1/auth/login', [
        'email'    => 'admin@wayfield.internal',
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(401);
    $response->assertJsonMissingPath('two_factor_session_token');
});

// ─── TOTP challenge ───────────────────────────────────────────────────────────

test('TOTP verify with valid session token and valid code returns full token', function () {
    [$admin, $secret] = adminWithTwoFactor();

    $this->postJson('/api/platform/v1/auth/login', [
        'email'    => 'admin@wayfield.internal',
        'password' => 'secure-password',
    ]);

    $loginResp   = $this->postJson('/api/platform/v1/auth/login', [
        'email'    => 'admin@wayfield.internal',
        'password' => 'secure-password',
    ]);
    $sessionToken = $loginResp->json('two_factor_session_token');

    $response = $this->postJson('/api/platform/v1/auth/two-factor', [
        'two_factor_session_token' => $sessionToken,
        'code'                     => validTotpCode($secret),
    ]);

    $response->assertOk()
        ->assertJsonStructure(['token', 'admin_user' => ['id', 'email', 'role']]);
});

test('TOTP verify with valid code consumes session token so it cannot be reused', function () {
    [$admin, $secret] = adminWithTwoFactor();

    $loginResp   = $this->postJson('/api/platform/v1/auth/login', [
        'email'    => 'admin@wayfield.internal',
        'password' => 'secure-password',
    ]);
    $sessionToken = $loginResp->json('two_factor_session_token');

    $this->postJson('/api/platform/v1/auth/two-factor', [
        'two_factor_session_token' => $sessionToken,
        'code'                     => validTotpCode($secret),
    ])->assertOk();

    // Second use of same session token should fail.
    $this->postJson('/api/platform/v1/auth/two-factor', [
        'two_factor_session_token' => $sessionToken,
        'code'                     => validTotpCode($secret),
    ])->assertStatus(422)
      ->assertJsonPath('message', 'Invalid or expired session. Please log in again.');
});

test('TOTP verify with invalid code returns 422 with attempts remaining', function () {
    adminWithTwoFactor();

    $loginResp   = $this->postJson('/api/platform/v1/auth/login', [
        'email'    => 'admin@wayfield.internal',
        'password' => 'secure-password',
    ]);
    $sessionToken = $loginResp->json('two_factor_session_token');

    $response = $this->postJson('/api/platform/v1/auth/two-factor', [
        'two_factor_session_token' => $sessionToken,
        'code'                     => '000000',
    ]);

    $response->assertStatus(422)
        ->assertJsonPath('message', 'Invalid code.')
        ->assertJsonStructure(['attempts_remaining']);

    expect($response->json('attempts_remaining'))->toBe(4);
});

test('TOTP verify with expired session token returns 422', function () {
    $response = $this->postJson('/api/platform/v1/auth/two-factor', [
        'two_factor_session_token' => 'nonexistent-token',
        'code'                     => '123456',
    ]);

    $response->assertStatus(422)
        ->assertJsonPath('message', 'Invalid or expired session. Please log in again.');
});

test('TOTP verify after 5 failed attempts invalidates session and returns 422', function () {
    adminWithTwoFactor();

    $loginResp   = $this->postJson('/api/platform/v1/auth/login', [
        'email'    => 'admin@wayfield.internal',
        'password' => 'secure-password',
    ]);
    $sessionToken = $loginResp->json('two_factor_session_token');

    foreach (range(1, 5) as $attempt) {
        $response = $this->postJson('/api/platform/v1/auth/two-factor', [
            'two_factor_session_token' => $sessionToken,
            'code'                     => '000000',
        ]);
        $response->assertStatus(422);
    }

    // After 5 failures the session is gone — even a valid code must fail.
    $response = $this->postJson('/api/platform/v1/auth/two-factor', [
        'two_factor_session_token' => $sessionToken,
        'code'                     => '000000',
    ]);
    $response->assertStatus(422);
    expect(Cache::get("2fa_session:{$sessionToken}"))->toBeNull();
});

// ─── Recovery codes ───────────────────────────────────────────────────────────

test('recovery code verify with valid code returns full token and removes used code', function () {
    [$admin, $secret, $plainCodes] = adminWithTwoFactor();

    $loginResp   = $this->postJson('/api/platform/v1/auth/login', [
        'email'    => 'admin@wayfield.internal',
        'password' => 'secure-password',
    ]);
    $sessionToken = $loginResp->json('two_factor_session_token');

    $response = $this->postJson('/api/platform/v1/auth/two-factor/recovery', [
        'two_factor_session_token' => $sessionToken,
        'recovery_code'            => $plainCodes[0],
    ]);

    $response->assertOk()->assertJsonStructure(['token']);

    // The used code is no longer in the database.
    $remaining = $admin->fresh()->validRecoveryCodes();
    expect(count($remaining))->toBe(7);
});

test('recovery code verify with already used code returns 422', function () {
    [$admin, $secret, $plainCodes] = adminWithTwoFactor();

    // Consume the first code directly.
    $admin->consumeRecoveryCode($plainCodes[0]);

    $loginResp   = $this->postJson('/api/platform/v1/auth/login', [
        'email'    => 'admin@wayfield.internal',
        'password' => 'secure-password',
    ]);
    $sessionToken = $loginResp->json('two_factor_session_token');

    $this->postJson('/api/platform/v1/auth/two-factor/recovery', [
        'two_factor_session_token' => $sessionToken,
        'recovery_code'            => $plainCodes[0],
    ])->assertStatus(422)
      ->assertJsonPath('message', 'Invalid recovery code.');
});

test('recovery code verify with invalid code returns 422', function () {
    adminWithTwoFactor();

    $loginResp   = $this->postJson('/api/platform/v1/auth/login', [
        'email'    => 'admin@wayfield.internal',
        'password' => 'secure-password',
    ]);
    $sessionToken = $loginResp->json('two_factor_session_token');

    $this->postJson('/api/platform/v1/auth/two-factor/recovery', [
        'two_factor_session_token' => $sessionToken,
        'recovery_code'            => 'XXXXX-XXXXX',
    ])->assertStatus(422);
});

// ─── Setup flow ───────────────────────────────────────────────────────────────

test('setup returns secret and QR code SVG and saves secret to admin', function () {
    $admin = make2faAdmin();

    $response = $this->withToken(platformToken($admin))
        ->getJson('/api/platform/v1/auth/two-factor/setup');

    $response->assertOk()
        ->assertJsonStructure(['secret', 'qr_code_svg'])
        ->assertJsonPath('already_configured', false);

    expect($admin->fresh()->two_factor_secret)->not->toBeNull();
});

test('setup returns already_configured when 2FA is active', function () {
    [$admin] = adminWithTwoFactor();

    $response = $this->withToken(platformToken($admin))
        ->getJson('/api/platform/v1/auth/two-factor/setup');

    $response->assertOk()->assertJsonPath('already_configured', true);
});

test('confirm with valid TOTP code completes setup and returns 8 recovery codes', function () {
    $admin  = make2faAdmin();
    $secret = app(TwoFactorAuthService::class)->generateSecret();
    $admin->forceFill(['two_factor_secret' => $secret])->save();

    $response = $this->withToken(platformToken($admin))
        ->postJson('/api/platform/v1/auth/two-factor/confirm', [
            'code' => validTotpCode($secret),
        ]);

    $response->assertOk()
        ->assertJsonPath('confirmed', true)
        ->assertJsonStructure(['recovery_codes']);

    expect($response->json('recovery_codes'))->toHaveCount(8);
    expect($admin->fresh()->hasTwoFactorEnabled())->toBeTrue();
});

test('confirm with invalid code returns 422', function () {
    $admin  = make2faAdmin();
    $secret = app(TwoFactorAuthService::class)->generateSecret();
    $admin->forceFill(['two_factor_secret' => $secret])->save();

    $this->withToken(platformToken($admin))
        ->postJson('/api/platform/v1/auth/two-factor/confirm', ['code' => '000000'])
        ->assertStatus(422);
});

// ─── Disable (self-service) ───────────────────────────────────────────────────

test('self-service disable with correct password and valid TOTP clears 2FA', function () {
    [$admin, $secret] = adminWithTwoFactor();

    $response = $this->withToken(platformToken($admin))
        ->postJson('/api/platform/v1/auth/two-factor/disable', [
            'password' => 'secure-password',
            'code'     => validTotpCode($secret),
        ]);

    $response->assertOk()->assertJsonPath('disabled', true);

    $fresh = $admin->fresh();
    expect($fresh->two_factor_confirmed_at)->toBeNull();
    expect($fresh->two_factor_secret)->toBeNull();
    expect($fresh->two_factor_recovery_codes)->toBeNull();
});

test('self-service disable with wrong password returns 422', function () {
    [$admin, $secret] = adminWithTwoFactor();

    $this->withToken(platformToken($admin))
        ->postJson('/api/platform/v1/auth/two-factor/disable', [
            'password' => 'wrong-password',
            'code'     => validTotpCode($secret),
        ])->assertStatus(422);
});

// ─── Admin override (disableForAdmin) ────────────────────────────────────────

test('super_admin can disable 2FA on another admin account', function () {
    [$target] = adminWithTwoFactor(['email' => 'target@wayfield.internal']);

    $superAdmin = make2faAdmin([
        'email' => 'super@wayfield.internal',
        'role'  => 'super_admin',
    ]);

    $response = $this->withToken(platformToken($superAdmin))
        ->postJson("/api/platform/v1/admins/{$target->id}/two-factor/disable");

    $response->assertOk()->assertJsonPath('disabled', true);

    expect($target->fresh()->hasTwoFactorEnabled())->toBeFalse();
});

test('non-super_admin cannot use admin disable endpoint', function () {
    [$target] = adminWithTwoFactor(['email' => 'target@wayfield.internal']);

    $admin = make2faAdmin(['email' => 'admin2@wayfield.internal', 'role' => 'admin']);

    $this->withToken(platformToken($admin))
        ->postJson("/api/platform/v1/admins/{$target->id}/two-factor/disable")
        ->assertStatus(403);
});

test('super_admin cannot use admin endpoint to disable own 2FA', function () {
    [$superAdmin] = adminWithTwoFactor([
        'email' => 'super@wayfield.internal',
        'role'  => 'super_admin',
    ]);

    $this->withToken(platformToken($superAdmin))
        ->postJson("/api/platform/v1/admins/{$superAdmin->id}/two-factor/disable")
        ->assertStatus(403);
});

// ─── Audit log ────────────────────────────────────────────────────────────────

test('enabling 2FA writes an audit log entry', function () {
    $admin  = make2faAdmin();
    $secret = app(TwoFactorAuthService::class)->generateSecret();
    $admin->forceFill(['two_factor_secret' => $secret])->save();

    $this->withToken(platformToken($admin))
        ->postJson('/api/platform/v1/auth/two-factor/confirm', [
            'code' => validTotpCode($secret),
        ])->assertOk();

    $this->assertDatabaseHas('platform_audit_logs', [
        'admin_user_id' => $admin->id,
        'action'        => 'two_factor.enabled',
        'entity_type'   => 'admin_user',
        'entity_id'     => $admin->id,
    ]);
});

test('disabling 2FA writes an audit log entry', function () {
    [$admin, $secret] = adminWithTwoFactor();

    $this->withToken(platformToken($admin))
        ->postJson('/api/platform/v1/auth/two-factor/disable', [
            'password' => 'secure-password',
            'code'     => validTotpCode($secret),
        ])->assertOk();

    $this->assertDatabaseHas('platform_audit_logs', [
        'admin_user_id' => $admin->id,
        'action'        => 'two_factor.disabled',
    ]);
});

test('super_admin disabling 2FA for another admin writes audit log with target info', function () {
    [$target] = adminWithTwoFactor(['email' => 'target@wayfield.internal']);

    $superAdmin = make2faAdmin([
        'email' => 'super@wayfield.internal',
        'role'  => 'super_admin',
    ]);

    $this->withToken(platformToken($superAdmin))
        ->postJson("/api/platform/v1/admins/{$target->id}/two-factor/disable")
        ->assertOk();

    $log = PlatformAuditLog::where('action', 'two_factor.disabled_by_admin')->first();
    expect($log)->not->toBeNull();
    expect($log->admin_user_id)->toBe($superAdmin->id);
    expect($log->entity_id)->toBe($target->id);
});

// ─── EnsureTwoFactorSetup middleware ─────────────────────────────────────────

test('admin with two_factor_required=true and no 2FA configured is blocked from protected routes', function () {
    $admin = make2faAdmin(['two_factor_required' => true]);

    $this->withToken(platformToken($admin))
        ->getJson('/api/platform/v1/auth/me')
        ->assertStatus(403)
        ->assertJsonPath('error', 'two_factor_setup_required');
});

test('admin with two_factor_required=true can still reach setup endpoint', function () {
    $admin = make2faAdmin(['two_factor_required' => true]);

    $this->withToken(platformToken($admin))
        ->getJson('/api/platform/v1/auth/two-factor/setup')
        ->assertOk();
});

test('admin with two_factor_required=true and 2FA configured is not blocked', function () {
    [$admin] = adminWithTwoFactor(['two_factor_required' => true]);

    $this->withToken(platformToken($admin))
        ->getJson('/api/platform/v1/auth/me')
        ->assertOk();
});

// ─── me endpoint includes 2FA status ─────────────────────────────────────────

test('me endpoint includes two_factor_enabled field', function () {
    [$admin] = adminWithTwoFactor();

    $this->withToken(platformToken($admin))
        ->getJson('/api/platform/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('two_factor_enabled', true);
});

test('me endpoint shows two_factor_enabled false when not configured', function () {
    $admin = make2faAdmin();

    $this->withToken(platformToken($admin))
        ->getJson('/api/platform/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('two_factor_enabled', false);
});
