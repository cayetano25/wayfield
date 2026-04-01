<?php

namespace App\Policies;

use App\Models\Registration;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;

class SessionSelectionPolicy
{
    /**
     * User can select sessions if they have an active registration for the workshop.
     */
    public function create(User $user, Workshop $workshop): bool
    {
        return $workshop->isPublished()
            && $workshop->isSessionBased()
            && $workshop->registrations()
                ->where('user_id', $user->id)
                ->where('registration_status', 'registered')
                ->exists();
    }

    /**
     * User can deselect sessions they have selected.
     */
    public function delete(User $user, Session $session, Workshop $workshop): bool
    {
        return $workshop->registrations()
            ->where('user_id', $user->id)
            ->where('registration_status', 'registered')
            ->exists();
    }
}
