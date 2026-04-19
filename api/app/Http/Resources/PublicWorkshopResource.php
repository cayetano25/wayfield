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
 * - public_page_enabled (internal state)
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
            'id' => $this->id,
            'workshop_type' => $this->workshop_type,
            'title' => $this->title,
            'description' => $this->description,
            'public_summary' => $this->public_summary,
            'status' => 'published', // always published on public endpoint — never leak internal status

            'timezone' => $this->timezone,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'public_slug' => $this->public_slug,
            'public_page_is_indexable' => (bool) $this->public_page_is_indexable,
            'canonical_url' => $this->resolveCanonicalUrl(),

            // Social metadata for OG / Twitter Card tags.
            // Falls back through the summary chain when dedicated fields are absent.
            'social_share_title' => $this->social_share_title ?? $this->title,
            'social_share_description' => $this->social_share_description
                ?? $this->public_summary
                ?? $this->description,
            'social_share_image_url' => $this->resolveSocialImageUrl(),

            // City and state only — full address is organizer-only.
            'default_location' => $this->whenLoaded(
                'defaultLocation',
                fn () => $this->defaultLocation ? new PublicLocationResource($this->defaultLocation) : null
            ),

            'logistics' => $this->whenLoaded(
                'logistics',
                fn () => $this->logistics ? new PublicWorkshopLogisticsResource($this->logistics) : null
            ),

            'public_page' => $this->whenLoaded('publicPage', fn () => $this->publicPage ? [
                'hero_title' => $this->publicPage->hero_title,
                'hero_subtitle' => $this->publicPage->hero_subtitle,
                'body_content' => $this->publicPage->body_content,
            ] : null),

            // Published sessions — meeting_url and all virtual credentials are intentionally excluded.
            // See PublicSessionResource for the safe field list.
            'sessions' => $this->whenLoaded(
                'sessions',
                fn () => PublicSessionResource::collection($this->sessions)
            ),

            // Only accepted + confirmed leaders are publicly listed.
            // PublicLeaderResource enforces strict privacy — no email, phone, or address.
            'leaders' => $this->whenLoaded(
                'confirmedLeaders',
                fn () => PublicLeaderResource::collection($this->confirmedLeaders)
            ),
        ];
    }

    private function resolveCanonicalUrl(): string
    {
        if ($this->canonical_url_override) {
            return $this->canonical_url_override;
        }

        return rtrim(config('app.url'), '/').'/w/'.$this->public_slug;
    }

    private function resolveSocialImageUrl(): ?string
    {
        // Priority 1: social_share_image_file_id — requires a `files` table not yet implemented.
        // When the files table is added, resolve:
        //   $file = \App\Models\File::find($this->social_share_image_file_id);
        //   return $file ? rtrim(config('filesystems.cdn_domain'), '/').'/'.$file->storage_key : null;

        // Priority 2: workshop header image (already stored as an absolute CDN URL).
        if ($this->header_image_url) {
            return $this->header_image_url;
        }

        return null;
    }
}
