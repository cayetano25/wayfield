<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public-safe organizer serialization.
 *
 * FORBIDDEN — never add:
 * - primary_contact_email, primary_contact_phone
 * - primary_contact_first_name, primary_contact_last_name
 * - any billing, subscription, or internal state
 */
class PublicOrganizerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'name'      => $this->name,
            'slug'      => $this->slug,
            'workshops' => PublicWorkshopListResource::collection(
                $this->getRelation('publicWorkshops') ?? collect()
            ),
        ];
    }
}
