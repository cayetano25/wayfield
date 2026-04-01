<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttendanceSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = $this->resource;

        return [
            'workshop_id'         => $data['workshop_id'],
            'total_registrations' => $data['total_registrations'],
            'sessions'            => array_map(function (array $session) {
                return [
                    'session_id'     => $session['session_id'],
                    'title'          => $session['title'],
                    'start_at'       => $session['start_at'],
                    'end_at'         => $session['end_at'],
                    'checked_in'     => $session['checked_in'],
                    'no_show'        => $session['no_show'],
                    'not_checked_in' => $session['not_checked_in'],
                    'total_records'  => $session['total_records'],
                ];
            }, $data['sessions']),
        ];
    }
}
