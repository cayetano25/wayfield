<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Full workshop data for organizer/admin context.
 * Includes all management fields — never returned to public/participant endpoints.
 */
class OrganizerWorkshopResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'organization_id'     => $this->organization_id,
            'workshop_type'       => $this->workshop_type,
            'title'               => $this->title,
            'description'         => $this->description,
            'status'              => $this->status,
            'timezone'            => $this->timezone,
            'start_date'          => $this->start_date?->toDateString(),
            'end_date'            => $this->end_date?->toDateString(),
            'join_code'           => $this->join_code,
            'public_page_enabled' => $this->public_page_enabled,
            'public_slug'         => $this->public_slug,
            'default_location'    => $this->whenLoaded('defaultLocation', fn () =>
                new LocationResource($this->defaultLocation)
            ),
            'logistics'           => $this->whenLoaded('logistics', fn () =>
                $this->logistics ? new WorkshopLogisticsResource($this->logistics) : null
            ),
            'public_page'         => $this->whenLoaded('publicPage', fn () =>
                $this->publicPage ? [
                    'hero_title'    => $this->publicPage->hero_title,
                    'hero_subtitle' => $this->publicPage->hero_subtitle,
                    'body_content'  => $this->publicPage->body_content,
                    'is_visible'    => $this->publicPage->is_visible,
                    'updated_at'    => $this->publicPage->updated_at?->toIso8601String(),
                ] : null
            ),
            'confirmed_leaders'   => $this->whenLoaded('confirmedLeaders', fn () =>
                $this->confirmedLeaders->map(fn ($leader) => [
                    'id'                => $leader->id,
                    'first_name'        => $leader->first_name,
                    'last_name'         => $leader->last_name,
                    'display_name'      => $leader->display_name,
                    'bio'               => $leader->bio,
                    'profile_image_url' => $leader->profile_image_url,
                    'website_url'       => $leader->website_url,
                    'city'              => $leader->city,
                    'state_or_region'   => $leader->state_or_region,
                ])
            ),
            'created_at'          => $this->created_at->toIso8601String(),
            'updated_at'          => $this->updated_at->toIso8601String(),
        ];
    }
}
