<?php

namespace App\Domain\Auth\Actions;

use App\Mail\EmailVerificationMail;
use App\Models\AuditLog;
use App\Models\AuthMethod;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

/**
 * Creates a new user account.
 *
 * Steps:
 *   1. Create the users row
 *   2. Create the auth_methods row (provider = email)
 *   3. Create an empty user_profiles row (address and phone added later in onboarding Step 2)
 *   4. Queue the email verification message
 *   5. Write audit log
 *
 * Per ROLE_MODEL.md Section 0: no role is set on the user record.
 * Role is determined by relationships, not by this action.
 */
class RegisterUserAction
{
    public function execute(array $data): User
    {
        // 1. Create the user — no role field; role is always relationship-derived.
        $user = User::create([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => strtolower(trim($data['email'])),
            'password_hash' => Hash::make($data['password']),
            'is_active' => true,
            'onboarding_intent' => $data['intent'] ?? null,
        ]);

        // 2. Create the email auth_methods record.
        AuthMethod::create([
            'user_id' => $user->id,
            'provider' => 'email',
            'provider_user_id' => null,
            'provider_email' => $user->email,
        ]);

        // 3. Create an empty user_profiles row.
        // Address and phone are collected in onboarding Step 2 and written there.
        $user->profile()->create([
            'user_id' => $user->id,
        ]);

        // 4. Queue the verification email.
        Mail::to($user->email)->queue(new EmailVerificationMail($user));

        // 5. Audit log — required for all auth events per CLAUDE.md.
        AuditLog::create([
            'organization_id' => null,
            'actor_user_id' => $user->id,
            'entity_type' => 'user',
            'entity_id' => $user->id,
            'action' => 'user.registered',
            'metadata_json' => [
                'email' => $user->email,
                'provider' => 'email',
            ],
        ]);

        return $user;
    }
}
