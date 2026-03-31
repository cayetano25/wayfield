<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateLocationRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name'            => ['sometimes', 'nullable', 'string', 'max:255'],
            'address_line_1'  => ['sometimes', 'nullable', 'string', 'max:255'],
            'address_line_2'  => ['sometimes', 'nullable', 'string', 'max:255'],
            'city'            => ['sometimes', 'nullable', 'string', 'max:100'],
            'state_or_region' => ['sometimes', 'nullable', 'string', 'max:100'],
            'postal_code'     => ['sometimes', 'nullable', 'string', 'max:30'],
            'country'         => ['sometimes', 'nullable', 'string', 'max:100'],
            'latitude'        => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude'       => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
        ];
    }
}
