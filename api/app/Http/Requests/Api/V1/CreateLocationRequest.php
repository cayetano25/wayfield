<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CreateLocationRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name'            => ['nullable', 'string', 'max:255'],
            'address_line_1'  => ['nullable', 'string', 'max:255'],
            'address_line_2'  => ['nullable', 'string', 'max:255'],
            'city'            => ['nullable', 'string', 'max:100'],
            'state_or_region' => ['nullable', 'string', 'max:100'],
            'postal_code'     => ['nullable', 'string', 'max:30'],
            'country'         => ['nullable', 'string', 'max:100'],
            'latitude'        => ['nullable', 'numeric', 'between:-90,90'],
            'longitude'       => ['nullable', 'numeric', 'between:-180,180'],
        ];
    }
}
