<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateLeaderProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'first_name'        => ['sometimes', 'required', 'string', 'max:100'],
            'last_name'         => ['sometimes', 'required', 'string', 'max:100'],
            'display_name'      => ['nullable', 'string', 'max:255'],
            'bio'               => ['nullable', 'string'],
            'profile_image_url' => ['nullable', 'string', 'url', 'max:500'],
            'website_url'       => ['nullable', 'string', 'url', 'max:500'],
            'phone_number'      => ['nullable', 'string', 'max:50'],
            'city'              => ['nullable', 'string', 'max:100'],
            'state_or_region'   => ['nullable', 'string', 'max:100'],
            'address_line_1'    => ['nullable', 'string', 'max:255'],
            'address_line_2'    => ['nullable', 'string', 'max:255'],
            'postal_code'       => ['nullable', 'string', 'max:30'],
            'country'           => ['nullable', 'string', 'max:100'],
        ];
    }
}
