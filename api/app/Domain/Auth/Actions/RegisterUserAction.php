<?php

namespace App\Domain\Auth\Actions;

use App\Models\AuthMethod;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Support\Facades\Hash;

class RegisterUserAction
{
    public function execute(array $data): User
    {
        $user = User::create([
            'first_name'   => $data['first_name'],
            'last_name'    => $data['last_name'],
            'email'        => $data['email'],
            'password_hash' => Hash::make($data['password']),
            'is_active'    => true,
        ]);

        AuthMethod::create([
            'user_id'        => $user->id,
            'provider'       => 'email',
            'provider_email' => $user->email,
        ]);

        $user->notify(new VerifyEmailNotification());

        return $user;
    }
}
