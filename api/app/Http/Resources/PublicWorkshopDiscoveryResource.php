<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Discovery-specific public workshop serialization.
 *
 * This resource is SEPARATE from PublicWorkshopResource by design.
 * Discovery has stricter field exclusions than individual workshop pages.
 * Do NOT merge or inherit from PublicWorkshopResource.
 *
 * FORBIDDEN — these must NEVER appear in any response from this class:
 * - join_code (grants workshop access — extremely sensitive)
 * - organization_id or any internal org metadata
 * - meeting_url, meeting_id, meeting_passcode, meeting_instructions
 * - participant roster data, phone numbers, emails
 * - registration counts or any PII
 * - leader email, phone, address_line_1, address_line_2, postal_code, country
 * - full logistics address (city/state only for hotel location)
 *
 * If you add a field, verify it is explicitly listed as safe in
 * PERMISSIONS_AND_PRIVACY_MODEL.md before adding it.
 */
class PublicWorkshopDiscoveryResource extends JsonResource
{
    /**
     * Whether to include the extended detail fields (leaders, sessions, logistics, public_page).
     * Set to true for the single-workshop detail endpoint.
     */
    public bool $includeDetail = false;

    public function toArray(Request $request): array
    {
        $base = [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->truncateDescription($this->description),
            'workshop_type' => $this->workshop_type,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'timezone' => $this->timezone,
            'public_slug' => $this->public_slug,
            'location' => $this->serializeLocation(),
            'leader_count' => $this->whenLoaded('confirmedLeaders', fn () => $this->confirmedLeaders->count(),
                $this->confirmed_leaders_count ?? 0,
            ),
            'session_count' => $this->whenLoaded('sessions', fn () => $this->sessions->where('is_published', true)->count(),
                $this->published_sessions_count ?? 0,
            ),
            // join_code is intentionally absent — triple-checked.
        ];

        if ($this->includeDetail) {
            $base['leaders'] = $this->whenLoaded('confirmedLeaders',
                fn () => $this->confirmedLeaders->map(fn ($l) => $this->serializeLeader($l))
            );
            $base['sessions'] = $this->whenLoaded('sessions',
                fn () => $this->sessions
                    ->where('is_published', true)
                    ->values()
                    ->map(fn ($s) => $this->serializeSession($s))
            );
            $base['logistics'] = $this->whenLoaded('logistics',
                fn () => $this->logistics ? $this->serializeLogistics($this->logistics) : null
            );
            $base['public_page'] = $this->whenLoaded('publicPage',
                fn () => $this->publicPage ? [
                    'hero_title' => $this->publicPage->hero_title,
                    'hero_subtitle' => $this->publicPage->hero_subtitle,
                    'body_content' => $this->publicPage->body_content,
                ] : null
            );
        }

        return $base;
    }

    /**
     * Description is truncated to 200 characters in discovery listings.
     * Full bio content is never shown in discovery to prevent data scraping.
     */
    private function truncateDescription(?string $text): ?string
    {
        if ($text === null) {
            return null;
        }

        return mb_strlen($text) > 200 ? mb_substr($text, 0, 200).'…' : $text;
    }

    private function serializeLocation(): ?array
    {
        $location = $this->relationLoaded('defaultLocation') ? $this->defaultLocation : null;

        if (! $location) {
            return null;
        }

        return [
            'city' => $location->city,
            'state_or_region' => $location->state_or_region,
            'country' => $location->country,
        ];
    }

    /**
     * Leader serialization for discovery — only public-safe fields.
     * Never expose email, phone, address_line_1, address_line_2, postal_code, country.
     */
    private function serializeLeader($leader): array
    {
        return [
            'id' => $leader->id,
            'first_name' => $leader->first_name,
            'last_name' => $leader->last_name,
            'display_name' => $leader->display_name,
            'profile_image_url' => $leader->profile_image_url,
            'bio' => $leader->bio,
            'website_url' => $leader->website_url,
            'city' => $leader->city,
            'state_or_region' => $leader->state_or_region,
            // email, phone_number, address_line_1/2, postal_code, country — intentionally absent
        ];
    }

    /**
     * Session serialization for discovery — only public-safe fields.
     * Never expose meeting_url, meeting_id, meeting_passcode, notes, or instructions.
     */
    private function serializeSession($session): array
    {
        $location = $session->relationLoaded('location') ? $session->location : null;

        return [
            'id' => $session->id,
            'title' => $session->title,
            'start_at' => $session->start_at?->toIso8601String(),
            'end_at' => $session->end_at?->toIso8601String(),
            'delivery_type' => $session->delivery_type,
            'capacity' => $session->capacity,
            'location' => $location ? [
                'city' => $location->city,
                'state_or_region' => $location->state_or_region,
            ] : null,
            // meeting_url, meeting_id, meeting_passcode, notes — intentionally absent
        ];
    }

    /**
     * Logistics serialization for discovery — hotel city/state only, not full address.
     * parking_details and meetup_instructions are informational and safe to show.
     */
    private function serializeLogistics($logistics): array
    {
        return [
            'hotel_name' => $logistics->hotel_name,
            // hotel_address deliberately omitted — city/state only policy for discovery
            'parking_details' => $logistics->parking_details,
            'meetup_instructions' => $logistics->meetup_instructions,
        ];
    }
}
