<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CreateSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Authorization handled in controller via policy
    }

    public function rules(): array
    {
        return [
            'track_id'                     => ['nullable', 'integer', 'exists:tracks,id'],
            'title'                        => ['required', 'string', 'max:255'],
            'description'                  => ['nullable', 'string'],
            'start_at'                     => ['required', 'date'],
            'end_at'                       => ['required', 'date', 'after:start_at'],
            'location_id'                  => ['nullable', 'integer', 'exists:locations,id'],
            'capacity'                     => ['nullable', 'integer', 'min:1'],
            'delivery_type'                => ['required', 'string', 'in:in_person,virtual,hybrid'],
            'virtual_participation_allowed' => ['boolean'],
            'meeting_platform'             => ['nullable', 'string', 'max:100'],
            'meeting_url'                  => ['nullable', 'string', 'url', 'max:1000'],
            'meeting_instructions'         => ['nullable', 'string'],
            'meeting_id'                   => ['nullable', 'string', 'max:255'],
            'meeting_passcode'             => ['nullable', 'string', 'max:255'],
            'notes'                        => ['nullable', 'string'],
        ];
    }
}
