<?php

namespace App\Http\Resources;

use App\Domain\Payments\Services\PriceResolutionService;
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

            'seo_title'       => $this->seo_title,
            'seo_description' => $this->seo_description,
            'seo_image_url'   => $this->seo_image_url ?? $this->header_image_url,

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

            'categories' => $this->whenLoaded('categories', fn () =>
                $this->categories->map(fn ($c) => [
                    'name' => $c->name,
                    'slug' => $c->slug,
                ])->values()->all()
            ),

            // Taxonomy: category, subcategory, specialization, and cross-cutting tags.
            // group_key is included so the frontend can group tags by type for display.
            'taxonomy' => $this->buildTaxonomyArray(),

            // Minimal org info needed for cart/checkout routing — no contact details.
            'organization' => $this->whenLoaded('organization', fn () => $this->organization ? [
                'id'   => $this->organization->id,
                'slug' => $this->organization->slug,
            ] : null),

            // Pricing display — safe for public consumption (no internal tier IDs).
            'pricing' => app(PriceResolutionService::class)->buildPublicPricingDisplay($this->resource),
        ];
    }

    private function buildTaxonomyArray(): array
    {
        $primary = $this->relationLoaded('primaryTaxonomy') ? $this->primaryTaxonomy : null;
        $tags    = $this->relationLoaded('tags') ? $this->tags : collect();

        return [
            'category' => $primary?->relationLoaded('category') && $primary->category ? [
                'id'   => $primary->category->id,
                'name' => $primary->category->name,
                'slug' => $primary->category->slug,
            ] : null,
            'subcategory' => $primary?->relationLoaded('subcategory') && $primary->subcategory ? [
                'id'   => $primary->subcategory->id,
                'name' => $primary->subcategory->name,
                'slug' => $primary->subcategory->slug,
            ] : null,
            'specialization' => $primary?->relationLoaded('specialization') && $primary->specialization ? [
                'id'   => $primary->specialization->id,
                'name' => $primary->specialization->name,
                'slug' => $primary->specialization->slug,
            ] : null,
            'tags' => $tags->map(fn ($tag) => [
                'id'          => $tag->id,
                'group_key'   => $tag->relationLoaded('tagGroup') ? $tag->tagGroup?->key : null,
                'group_label' => $tag->relationLoaded('tagGroup') ? $tag->tagGroup?->label : null,
                'value'       => $tag->value,
                'label'       => $tag->label,
            ])->values()->all(),
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
