<?php

namespace App\Http\Resources;

use App\Models\Location;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaderSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $session = $this->resource;
        $workshop = $session->workshop;
        $defaultLocation = $workshop->defaultLocation ?? null;
        $resolvedLocation = $session->location ?? $defaultLocation;
        $logistics = $workshop->logistics ?? null;

        return [
            'id' => $session->id,
            'title' => $session->title,
            'description' => $session->description,
            'start_at' => $session->start_at?->toIso8601String(),
            'end_at' => $session->end_at?->toIso8601String(),
            'workshop' => [
                'id' => $workshop->id,
                'title' => $workshop->title,
                'timezone' => $workshop->timezone,
                'default_location' => $this->serializeLocation($defaultLocation),
            ],
            'location' => $this->serializeLocation($resolvedLocation),
            'workshop_hotel' => [
                'hotel_name' => $logistics?->hotel_name,
                'hotel_address' => $logistics?->hotel_address,
                'hotel_phone' => $logistics?->hotel_phone,
            ],
            'capacity' => $session->capacity,
            'enrolled_count' => $this->resolveEnrolledCount($session, $workshop),
            'session_type' => $session->session_type,
            'publication_status' => $session->publication_status,
            'messaging_window_open' => $this->resolveMessagingWindowOpen($session),
            'messaging_window_start' => $session->start_at?->copy()->subHours(4)->toIso8601String(),
            'messaging_window_end' => $session->end_at?->copy()->addHours(2)->toIso8601String(),
            'participants' => $this->resolveParticipants($session, $workshop),
        ];
    }

    private function serializeLocation(?Location $loc): ?array
    {
        if (! $loc) {
            return null;
        }

        return [
            'id' => $loc->id,
            'name' => $loc->name,
            'address_line_1' => $loc->address_line_1,
            'address_line_2' => $loc->address_line_2,
            'city' => $loc->city,
            'state_or_region' => $loc->state_or_region,
            'postal_code' => $loc->postal_code,
            'latitude' => $loc->latitude !== null ? (float) $loc->latitude : null,
            'longitude' => $loc->longitude !== null ? (float) $loc->longitude : null,
        ];
    }

    private function resolveEnrolledCount($session, $workshop): int
    {
        if ($workshop->workshop_type === 'session_based') {
            return $session->selections
                ->where('selection_status', 'selected')
                ->count();
        }

        return $workshop->registrations
            ->where('registration_status', 'registered')
            ->count();
    }

    private function resolveMessagingWindowOpen($session): bool
    {
        if (! $session->start_at || ! $session->end_at) {
            return false;
        }

        $now = now();
        $windowStart = $session->start_at->copy()->subHours(4);
        $windowEnd = $session->end_at->copy()->addHours(2);

        return $now->gte($windowStart) && $now->lte($windowEnd);
    }

    private function resolveParticipants($session, $workshop): array
    {
        $attendanceByUserId = $session->attendanceRecords->keyBy('user_id');

        if ($workshop->workshop_type === 'session_based') {
            $users = $session->selections
                ->where('selection_status', 'selected')
                ->map(fn ($sel) => $sel->registration?->user)
                ->filter()
                ->unique('id');
        } else {
            $users = $workshop->registrations
                ->where('registration_status', 'registered')
                ->map(fn ($reg) => $reg->user)
                ->filter()
                ->unique('id');
        }

        return $users->map(function (User $user) use ($attendanceByUserId) {
            $record = $attendanceByUserId->get($user->id);

            return [
                'user' => [
                    'id' => $user->id,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'phone_number' => $user->phone_number,
                ],
                'attendance' => [
                    'status' => $record?->status ?? 'not_checked_in',
                    'check_in_method' => $record?->check_in_method,
                    'checked_in_at' => $record?->checked_in_at?->toIso8601String(),
                ],
            ];
        })->values()->all();
    }
}
