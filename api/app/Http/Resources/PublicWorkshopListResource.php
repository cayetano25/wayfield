<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Lightweight public workshop resource for listing/discovery pages.
 *
 * FORBIDDEN — never add to this resource:
 * - join_code, organization_id, public_page_enabled, status
 * - meeting_url, meeting_id, meeting_passcode
 * - participant roster, phone numbers, any PII
 * - leader email, phone, address fields
 * - full location address (address_line_1, postal_code)
 */
class PublicWorkshopListResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'title'         => $this->title,
            'public_slug'   => $this->public_slug,
            'workshop_type' => $this->workshop_type,
            'start_date'    => $this->start_date?->toDateString(),
            'end_date'      => $this->end_date?->toDateString(),
            'timezone'      => $this->timezone,
            'location'      => $this->whenLoaded('defaultLocation', fn () =>
                $this->defaultLocation ? [
                    'city'            => $this->defaultLocation->city,
                    'state_or_region' => $this->defaultLocation->state_or_region,
                    'country'         => $this->defaultLocation->country,
                ] : null
            ),
            'categories'    => $this->whenLoaded('categories', fn () =>
                $this->categories->map(fn ($c) => [
                    'name' => $c->name,
                    'slug' => $c->slug,
                ])->values()->all()
            ),
            'seo_title'       => $this->seo_title,
            'seo_description' => $this->seo_description,
            'seo_image_url'   => $this->seo_image_url ?? $this->header_image_url,
            'updated_at'      => $this->updated_at?->toIso8601String(),
        ];
    }
}
