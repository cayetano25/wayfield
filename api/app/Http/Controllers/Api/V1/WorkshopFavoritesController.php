<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicWorkshopResource;
use App\Models\Workshop;
use App\Models\WorkshopFavorite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class WorkshopFavoritesController extends Controller
{
    public function toggle(Request $request, Workshop $workshop): JsonResponse
    {
        $user = $request->user();
        $exists = WorkshopFavorite::where('user_id', $user->id)
            ->where('workshop_id', $workshop->id)
            ->exists();

        if ($exists) {
            WorkshopFavorite::where('user_id', $user->id)
                ->where('workshop_id', $workshop->id)
                ->delete();
            $favorited = false;
        } else {
            WorkshopFavorite::create([
                'user_id'     => $user->id,
                'workshop_id' => $workshop->id,
            ]);
            $favorited = true;
        }

        return response()->json([
            'data' => [
                'workshop_id'     => $workshop->id,
                'favorited'       => $favorited,
                'favorites_count' => $workshop->favoritedByUsers()->count(),
            ],
        ]);
    }

    public function favorites(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $workshops = Workshop::whereHas('favoritedByUsers', fn ($q) => $q->where('user_id', $user->id))
            ->with([
                'organization',
                'defaultLocation',
                'logistics',
                'publicPage',
                'categories',
                'confirmedLeaders',
                'sessions' => fn ($q) => $q
                    ->where('is_published', true)
                    ->where('participant_visibility', 'visible')
                    ->orderBy('start_at')
                    ->with(['location', 'sessionLeaders.leader']),
                'primaryTaxonomy.category',
                'primaryTaxonomy.subcategory',
                'primaryTaxonomy.specialization',
                'tags.tagGroup',
            ])
            ->paginate(24);

        // All items in this collection are favorited — pass the flag via additional data.
        return PublicWorkshopResource::collection($workshops)
            ->additional(['meta' => ['is_favorites_list' => true]]);
    }

    public function isFavorited(Request $request, Workshop $workshop): JsonResponse
    {
        $favorited = WorkshopFavorite::where('user_id', $request->user()->id)
            ->where('workshop_id', $workshop->id)
            ->exists();

        return response()->json([
            'data' => [
                'favorited' => $favorited,
            ],
        ]);
    }
}
