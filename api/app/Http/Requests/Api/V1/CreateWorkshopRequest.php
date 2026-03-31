<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateWorkshopRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'workshop_type'       => ['required', Rule::in(['session_based', 'event_based'])],
            'title'               => ['required', 'string', 'max:255'],
            'description'         => ['required', 'string'],
            'timezone'            => ['required', 'string', 'timezone'],
            'start_date'          => ['required', 'date'],
            'end_date'            => ['required', 'date', 'after_or_equal:start_date'],
            'default_location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'public_page_enabled' => ['nullable', 'boolean'],
            'public_slug'         => ['nullable', 'string', 'max:255', 'alpha_dash', 'unique:workshops,public_slug'],
        ];
    }
}
