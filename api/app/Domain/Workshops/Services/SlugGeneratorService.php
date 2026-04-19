<?php

namespace App\Domain\Workshops\Services;

use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Support\Str;

class SlugGeneratorService
{
    public function generate(Workshop $workshop): string
    {
        $base = Str::slug($workshop->title);
        $year = Carbon::parse($workshop->start_date)->format('Y');
        $orgSlug = Str::slug(Str::limit($workshop->organization->name, 12, ''));

        $candidates = [
            $base,
            "{$base}-{$year}",
            "{$base}-{$year}-{$orgSlug}",
            "{$base}-{$year}-{$orgSlug}-" . Str::lower(Str::random(4)),
        ];

        foreach ($candidates as $candidate) {
            $exists = Workshop::where('public_slug', $candidate)
                ->where('id', '!=', $workshop->id)
                ->exists();
            if (!$exists) {
                return $candidate;
            }
        }

        return "{$base}-" . Str::lower(Str::random(8));
    }

    public function generateAndSave(Workshop $workshop): string
    {
        if ($workshop->public_slug) {
            return $workshop->public_slug;
        }

        $slug = $this->generate($workshop);
        $workshop->update(['public_slug' => $slug]);
        return $slug;
    }
}
