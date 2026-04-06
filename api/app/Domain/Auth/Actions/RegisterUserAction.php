<?php

namespace App\Domain\Auth\Actions;

use App\Mail\EmailVerificationMail;
use App\Models\AuthMethod;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

class RegisterUserAction
{
    public function execute(array $data): User
    {
        $user = User::create([
            'first_name'         => $data['first_name'],
            'last_name'          => $data['last_name'],
            'email'              => $data['email'],
            'password_hash'      => Hash::make($data['password']),
            'is_active'          => true,
            'onboarding_intent'  => $data['intent'] ?? null,
        ]);

        AuthMethod::create([
            'user_id'        => $user->id,
            'provider'       => 'email',
            'provider_email' => $user->email,
        ]);

        Mail::to($user->email)->queue(new EmailVerificationMail($user));

        return $user;
    }
}
