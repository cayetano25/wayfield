<?php

namespace App\Domain\Organizations\Actions;

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Str;

class CreateOrganizationAction
{
    public function execute(User $user, array $data): Organization
    {
        $organization = Organization::create([
            'name'                        => $data['name'],
            'slug'                        => $data['slug'] ?? Str::slug($data['name']),
            'primary_contact_first_name'  => $data['primary_contact_first_name'],
            'primary_contact_last_name'   => $data['primary_contact_last_name'],
            'primary_contact_email'       => $data['primary_contact_email'],
            'primary_contact_phone'       => $data['primary_contact_phone'] ?? null,
            'status'                      => 'active',
        ]);

        OrganizationUser::create([
            'organization_id' => $organization->id,
            'user_id'         => $user->id,
            'role'            => 'owner',
            'is_active'       => true,
        ]);

        Subscription::create([
            'organization_id' => $organization->id,
            'plan_code'       => 'free',
            'status'          => 'active',
            'starts_at'       => now(),
            'ends_at'         => null,
        ]);

        return $organization;
    }
}
