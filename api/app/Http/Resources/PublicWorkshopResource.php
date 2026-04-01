<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public-safe workshop serialization.
 *
 * Every field listed here has been explicitly approved for public exposure.
 * Do NOT add fields without reviewing the privacy rules in:
 *   docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md
 *
 * FORBIDDEN — never add these:
 * - join_code
 * - organization_id (or any internal org metadata)
 * - status / public_page_enabled (internal state)
 * - created_at / updated_at
 * - meeting_url, meeting_id, meeting_passcode, meeting_instructions (session virtual fields)
 * - any participant roster or phone number data
 * - leader email, phone, address_line_1, address_line_2, postal_code, country
 */
class PublicWorkshopResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'workshop_type'   => $this->workshop_type,
            'title'           => $this->title,
            'description'     => $this->description,
            'timezone'        => $this->timezone,
            'start_date'      => $this->start_date?->toDateString(),
            'end_date'        => $this->end_date?->toDateString(),
            'public_slug'     => $this->public_slug,
            'default_location' => $this->whenLoaded('defaultLocation', fn () =>
                $this->defaultLocation ? new LocationResource($this->defaultLocation) : null
            ),
            'logistics'       => $this->whenLoaded('logistics', fn () =>
                $this->logistics ? new PublicWorkshopLogisticsResource($this->logistics) : null
            ),
            'public_page'     => $this->whenLoaded('publicPage', fn () =>
                $this->publicPage ? [
                    'hero_title'    => $this->publicPage->hero_title,
                    'hero_subtitle' => $this->publicPage->hero_subtitle,
                    'body_content'  => $this->publicPage->body_content,
                ] : null
            ),
            // Published sessions — meeting_url and all virtual credentials are intentionally excluded.
            // See PublicSessionResource for the safe field list.
            'sessions'        => $this->whenLoaded('sessions',
                fn () => PublicSessionResource::collection($this->sessions)
            ),
        ];
    }
}
