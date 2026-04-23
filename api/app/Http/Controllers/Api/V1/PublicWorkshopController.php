<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicWorkshopResource;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;

class PublicWorkshopController extends Controller
{
    public function show(string $slug): JsonResponse
    {
        $workshop = Workshop::where('public_slug', $slug)
            ->where('status', 'published')
            ->where('public_page_enabled', true)
            ->with([
                'defaultLocation',
                'logistics',
                'publicPage',
                'sessions' => fn ($q) => $q->where('publication_status', 'published')
                    ->where('participant_visibility', 'visible')
                    ->orderBy('start_at')->with(['track', 'location']),
                // Only load confirmed leaders for public display
                'confirmedLeaders',
                'primaryTaxonomy.category',
                'primaryTaxonomy.subcategory',
                'primaryTaxonomy.specialization',
                'tags.tagGroup',
            ])
            ->first();

        if (! $workshop) {
            return response()->json(['message' => 'Workshop not found.'], 404);
        }

        return response()->json(new PublicWorkshopResource($workshop));
    }
}
