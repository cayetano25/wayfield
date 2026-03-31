<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWorkshopRequest extends FormRequest
{
    public function rules(): array
    {
        $workshopId = $this->route('workshop')?->id;

        return [
            'title'               => ['sometimes', 'required', 'string', 'max:255'],
            'description'         => ['sometimes', 'required', 'string'],
            'timezone'            => ['sometimes', 'required', 'string', 'timezone'],
            'start_date'          => ['sometimes', 'required', 'date'],
            'end_date'            => ['sometimes', 'required', 'date', 'after_or_equal:start_date'],
            'default_location_id' => ['sometimes', 'nullable', 'integer', 'exists:locations,id'],
            'public_page_enabled' => ['sometimes', 'boolean'],
            'public_slug'         => [
                'sometimes',
                'nullable',
                'string',
                'max:255',
                'alpha_dash',
                Rule::unique('workshops', 'public_slug')->ignore($workshopId),
            ],
        ];
    }
}
