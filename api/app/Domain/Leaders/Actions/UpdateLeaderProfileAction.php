<?php

namespace App\Domain\Leaders\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\Leader;
use App\Models\User;
use App\Services\Address\AddressService;

class UpdateLeaderProfileAction
{
    public function __construct(private readonly AddressService $addressService) {}

    /**
     * Update leader-owned profile fields.
     * Leaders own their profile — organizers must not be required to populate it.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(Leader $leader, User $actor, array $data): Leader
    {
        $allowed = [
            'first_name',
            'last_name',
            'display_name',
            'bio',
            'profile_image_url',
            'website_url',
            'phone_number',
            'city',
            'state_or_region',
            'address_line_1',
            'address_line_2',
            'postal_code',
            'country',
        ];

        $updates = array_intersect_key($data, array_flip($allowed));
        $addressData = $data['address'] ?? null;

        $leader->update($updates);

        if ($addressData !== null) {
            $leader->loadMissing('address');

            if ($leader->address_id && $leader->address) {
                $this->addressService->updateFromRequest($leader->address, $addressData);
            } else {
                $address = $this->addressService->createFromRequest($addressData);
                $leader->address_id = $address->id;
                $leader->save();
            }
        }

        AuditLogService::record([
            'actor_user_id' => $actor->id,
            'entity_type' => 'leader',
            'entity_id' => $leader->id,
            'action' => 'leader_profile_updated',
            'metadata' => ['updated_fields' => array_keys($updates)],
        ]);

        return $leader->fresh()->load('address');
    }
}
