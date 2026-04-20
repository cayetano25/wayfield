<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'first_name'                   => ['sometimes', 'required', 'string', 'max:100'],
            'last_name'                    => ['sometimes', 'required', 'string', 'max:100'],
            'profile_image_url'            => ['sometimes', 'nullable', 'string', 'max:2048'],
            'phone_number'                 => ['sometimes', 'nullable', 'string', 'max:50'],
            'address'                      => ['sometimes', 'nullable', 'array'],
            'address.country_code'         => ['required_with:address', 'size:2'],
            'address.address_line_1'       => ['required_with:address', 'string', 'max:255'],
            'address.address_line_2'       => ['nullable', 'string', 'max:255'],
            'address.address_line_3'       => ['nullable', 'string', 'max:255'],
            'address.locality'             => ['nullable', 'string', 'max:100'],
            'address.administrative_area'  => ['nullable', 'string', 'max:100'],
            'address.postal_code'          => ['nullable', 'string', 'max:30'],
            'address.dependent_locality'   => ['nullable', 'string', 'max:100'],
            'address.sorting_code'         => ['nullable', 'string', 'max:30'],
        ];
    }
}
