<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\SecurityEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformSecurityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $events = SecurityEvent::query()
            ->with(['organization:id,name', 'user:id,email'])
            ->when($request->input('severity'), function ($q, $severity) {
                $severities = array_filter(explode(',', $severity));
                $q->whereIn('severity', $severities);
            })
            ->when($request->input('event_type'), fn ($q, $type) => $q->where('event_type', $type))
            ->when($request->input('organization_id'), fn ($q, $id) => $q->where('organization_id', $id))
            ->when($request->input('date_from'), fn ($q, $from) => $q->where('created_at', '>=', $from))
            ->when($request->input('date_to'), fn ($q, $to) => $q->where('created_at', '<=', $to))
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        $events->getCollection()->transform(fn (SecurityEvent $event) => [
            'id'                => $event->id,
            'event_type'        => $event->event_type,
            'severity'          => $event->severity,
            'description'       => $event->description,
            'organization_id'   => $event->organization_id,
            'organization_name' => $event->organization?->name,
            'user_id'           => $event->user_id,
            'user_email'        => $event->user?->email,
            'metadata_json'     => $event->metadata_json,
            'created_at'        => $event->created_at?->toIso8601String(),
        ]);

        return response()->json($events);
    }
}
