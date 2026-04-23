<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Session participant resource for GET /api/v1/sessions/{session}/participants.
 *
 * Phone number visibility follows the project privacy rules:
 *   - Visible to: org owner, admin, staff; assigned leader for this session.
 *   - Hidden for: all others.
 *
 * Pass show_phone = true via ->additional(['show_phone' => true]) when the
 * caller is authorized to see phone numbers.
 *
 * The underlying resource is a SessionSelection model with eagerly loaded:
 *   $selection->registration->user
 *   $selection->assignedBy (optional)
 *   attendance_record (from a keyed collection passed via additional)
 */
class SessionParticipantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $selection = $this->resource;
        $user = $selection->registration?->user;
        $showPhone = $this->additional['show_phone'] ?? false;

        // Attendance record keyed by user_id, passed by the controller.
        $attendanceByUserId = $this->additional['attendance'] ?? collect();
        $attendance = $user ? $attendanceByUserId->get($user->id) : null;

        return [
            'selection_id' => $selection->id,
            'user_id' => $user?->id,
            'first_name' => $user?->first_name,
            'last_name' => $user?->last_name,
            'email' => $user?->email,
            'phone_number' => $showPhone ? $user?->phone_number : null,
            'assignment_source' => $selection->assignment_source,
            'assigned_by_user_id' => $selection->assigned_by_user_id,
            'assigned_at' => $selection->assigned_at?->toIso8601String(),
            'assignment_notes' => $selection->assignment_notes,
            'check_in_status' => $attendance?->status ?? 'not_checked_in',
        ];
    }
}
