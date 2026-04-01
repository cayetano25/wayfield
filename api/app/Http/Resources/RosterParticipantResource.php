<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Roster participant resource with phone-number visibility gating.
 *
 * Phone number is ONLY shown when the caller explicitly sets show_phone = true
 * via ->additional(['show_phone' => true]). The default is false.
 *
 * Authorized callers:
 * - Org owner, admin, or staff
 * - A leader explicitly assigned to THIS session
 *
 * Phone is NEVER shown to:
 * - Participants
 * - Leaders assigned to different sessions
 */
class RosterParticipantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // The $this->resource is a stdClass with: user, registration, attendance_record
        $entry = $this->resource;
        $user  = $entry->user;
        $attendance = $entry->attendance_record;

        // Show phone only when explicitly authorized by the controller
        $showPhone = $this->additional['show_phone'] ?? false;

        return [
            'user' => [
                'id'         => $user->id,
                'first_name' => $user->first_name,
                'last_name'  => $user->last_name,
                'email'      => $user->email,
                'phone_number' => $showPhone ? $user->phone_number : null,
            ],
            'registration_status' => $entry->registration->registration_status,
            'attendance' => $attendance ? [
                'status'          => $attendance->status,
                'check_in_method' => $attendance->check_in_method,
                'checked_in_at'   => $attendance->checked_in_at,
            ] : [
                'status'          => 'not_checked_in',
                'check_in_method' => null,
                'checked_in_at'   => null,
            ],
        ];
    }
}
