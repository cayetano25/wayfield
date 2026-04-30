<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkshopCardResource;
use App\Models\Workshop;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * GET /api/v1/public/workshops
 *
 * Taxonomy-aware public workshop discovery.
 * No authentication required.
 *
 * Privacy enforcement:
 * - join_code MUST NOT appear in any response.
 * - meeting_url and virtual credentials MUST NOT appear.
 * - No participant data, roster, or PII.
 * - Organization: id + name only — no contact details.
 */
class PublicWorkshopDiscoveryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'category'       => ['nullable', 'string', 'max:100'],
            'subcategory'    => ['nullable', 'string', 'max:150'],
            'specialization' => ['nullable', 'string', 'max:200'],
            'tag'            => ['nullable', 'array'],
            'tag.*'          => ['string', 'max:100'],
            'delivery_type'  => ['nullable', 'string', 'in:in_person,virtual,hybrid'],
            'start_after'    => ['nullable', 'date_format:Y-m-d'],
            'start_before'   => ['nullable', 'date_format:Y-m-d'],
            'q'              => ['nullable', 'string', 'max:100'],
            'per_page'       => ['nullable', 'integer', 'in:12,24,48'],
            'page'           => ['nullable', 'integer', 'min:1'],
            'sort'           => ['nullable', 'string', 'in:newest,start_date,relevance'],
        ]);

        $query = Workshop::query()
            ->where('status', 'published')
            ->where('public_page_enabled', true)
            ->with([
                'defaultLocation',
                'organization',
                'primaryTaxonomy.category',
                'primaryTaxonomy.subcategory',
                'primaryTaxonomy.specialization',
                'tags.tagGroup',
                'pricing',
            ])
            ->withCount('confirmedLeaders as confirmed_leaders_count');

        // ── Taxonomy filters ──────────────────────────────────────────────────

        if (! empty($validated['category'])) {
            $slug = $validated['category'];
            $query->whereHas('primaryTaxonomy', fn ($q) =>
                $q->whereHas('category', fn ($c) => $c->where('slug', $slug)->where('is_active', true))
            );
        }

        if (! empty($validated['subcategory'])) {
            $slug = $validated['subcategory'];
            $query->whereHas('primaryTaxonomy', fn ($q) =>
                $q->whereHas('subcategory', fn ($c) => $c->where('slug', $slug)->where('is_active', true))
            );
        }

        if (! empty($validated['specialization'])) {
            $slug = $validated['specialization'];
            $query->whereHas('primaryTaxonomy', fn ($q) =>
                $q->whereHas('specialization', fn ($c) => $c->where('slug', $slug)->where('is_active', true))
            );
        }

        // AND logic: workshop must have ALL specified tags
        if (! empty($validated['tag'])) {
            foreach ($validated['tag'] as $tagValue) {
                $query->whereHas('tags', fn ($q) => $q->where('value', $tagValue)->where('is_active', true));
            }
        }

        // ── Other filters ─────────────────────────────────────────────────────

        if (! empty($validated['delivery_type'])) {
            $dt = $validated['delivery_type'];
            $query->whereHas('sessions', fn ($q) =>
                $q->where('is_published', true)->where('delivery_type', $dt)
            );
        }

        if (! empty($validated['start_after'])) {
            $query->where('start_date', '>=', $validated['start_after']);
        }

        if (! empty($validated['start_before'])) {
            $query->where('start_date', '<=', $validated['start_before']);
        }

        if (! empty($validated['q'])) {
            $term = '%'.$validated['q'].'%';
            $query->where(fn ($q) =>
                $q->where('title', 'like', $term)->orWhere('description', 'like', $term)
            );
        }

        // ── Sorting ───────────────────────────────────────────────────────────

        $sort = $validated['sort'] ?? 'start_date';

        if ($sort === 'newest') {
            $query->orderBy('created_at', 'desc');
        } elseif ($sort === 'relevance' && ! empty($validated['q'])) {
            // Title matches rank higher than description matches — LIKE-based relevance.
            $term = $validated['q'];
            $query->orderByRaw(
                '(CASE WHEN title LIKE ? THEN 0 ELSE 1 END)',
                ['%'.$term.'%']
            )->orderBy('start_date');
        } else {
            $query->orderBy('start_date');
        }

        $perPage = $validated['per_page'] ?? 24;
        $paginated = $query->paginate($perPage);

        return WorkshopCardResource::collection($paginated);
    }
}
