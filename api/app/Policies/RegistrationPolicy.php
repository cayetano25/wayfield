<?php

namespace App\Policies;

use App\Models\Registration;
use App\Models\User;
use App\Models\Workshop;

class RegistrationPolicy
{
    /**
     * Any authenticated user can join (register for) a published workshop.
     */
    public function create(User $user, Workshop $workshop): bool
    {
        return $workshop->isPublished();
    }

    /**
     * User can view their own registration.
     */
    public function view(User $user, Registration $registration): bool
    {
        return $user->id === $registration->user_id;
    }

    /**
     * User can cancel their own active registration.
     */
    public function cancel(User $user, Registration $registration): bool
    {
        return $user->id === $registration->user_id && $registration->isActive();
    }
}
