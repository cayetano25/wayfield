<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\User;

class BillingPolicy
{
    // Allowed: owner, billing_admin
    // Denied: admin, staff, leaders, participants
    public function view(User $user, Organization $organization): bool
    {
        return $organization->hasBillingAccess($user);
    }

    // Allowed: owner, billing_admin
    // Denied: admin, staff, leaders, participants
    public function manage(User $user, Organization $organization): bool
    {
        return $organization->hasBillingAccess($user);
    }

    // Allowed: owner only
    // Denied: billing_admin, admin, staff, leaders, participants
    public function cancel(User $user, Organization $organization): bool
    {
        return $organization->memberRole($user) === 'owner';
    }

    // Allowed: owner, billing_admin
    // Denied: admin, staff, leaders, participants
    public function portal(User $user, Organization $organization): bool
    {
        return $organization->hasBillingAccess($user);
    }
}
