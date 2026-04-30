<?php

namespace App\Domain\Seo\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SlugGeneratorService
{
    /**
     * Convert any string to a URL-safe slug.
     */
    public function slugify(string $value): string
    {
        return Str::slug($value);
    }

    /**
     * Generate a unique slug for any table/column combination.
     * Collisions are resolved with numeric suffixes: my-slug, my-slug-2, my-slug-3.
     *
     * @param  string   $source     Source string to slugify (e.g. workshop title)
     * @param  string   $table      Target DB table name (e.g. 'workshops')
     * @param  string   $column     Target column name (e.g. 'public_slug')
     * @param  int|null $excludeId  Row ID to exclude (for update idempotency)
     */
    public function generate(
        string $source,
        string $table,
        string $column,
        ?int $excludeId = null,
    ): string {
        $base = $this->slugify($source);

        if (! $this->exists($base, $table, $column, $excludeId)) {
            return $base;
        }

        $counter = 2;
        do {
            $candidate = "{$base}-{$counter}";
            $counter++;
        } while ($this->exists($candidate, $table, $column, $excludeId));

        return $candidate;
    }

    /**
     * Workshop-specific slug generation. Deduplicates against workshops.public_slug.
     * Incorporates org slug as a tiebreaker before falling back to numeric suffixes.
     *
     * @param  string   $title            Workshop title
     * @param  string   $organizationSlug Org's slug (used as a tiebreaker)
     * @param  int|null $excludeId        Workshop ID to exclude (for update idempotency)
     */
    public function generateWorkshopSlug(
        string $title,
        string $organizationSlug,
        ?int $excludeId = null,
    ): string {
        $base = $this->slugify($title);

        if (! $this->exists($base, 'workshops', 'public_slug', $excludeId)) {
            return $base;
        }

        // Try incorporating the org slug as a natural tiebreaker before going numeric
        $withOrg = "{$base}-{$organizationSlug}";
        if (! $this->exists($withOrg, 'workshops', 'public_slug', $excludeId)) {
            return $withOrg;
        }

        // Fall back to numeric suffixes on the org-qualified slug
        $counter = 2;
        do {
            $candidate = "{$withOrg}-{$counter}";
            $counter++;
        } while ($this->exists($candidate, 'workshops', 'public_slug', $excludeId));

        return $candidate;
    }

    // ─────────────────────────────────────────────────────────────────────────

    private function exists(string $value, string $table, string $column, ?int $excludeId): bool
    {
        $query = DB::table($table)->where($column, $value);

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }
}
