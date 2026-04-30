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
            // first_name / last_name are on the users table — update via PATCH /api/v1/me
            // profile_image_url is handled via the dedicated image-upload endpoint
            'bio'            => ['nullable', 'string', 'max:2000'],
            'website_url'    => ['nullable', 'url', 'max:500'],
            'phone_number'   => ['nullable', 'string', 'max:50'],
            'address_line_1' => ['nullable', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'city'           => ['nullable', 'string', 'max:100'],
            'state_or_region' => ['nullable', 'string', 'max:100'],
            'postal_code'    => ['nullable', 'string', 'max:30'],
            'country'        => ['nullable', 'string', 'max:2'],
            'social_instagram' => ['nullable', 'string', 'max:100'],
            'social_twitter'   => ['nullable', 'string', 'max:100'],
            // Structured address (Phase 16)
            'address'                    => ['sometimes', 'nullable', 'array'],
            'address.country_code'       => ['required_with:address', 'size:2'],
            'address.address_line_1'     => ['required_with:address', 'string', 'max:255'],
            'address.address_line_2'     => ['nullable', 'string', 'max:255'],
            'address.address_line_3'     => ['nullable', 'string', 'max:255'],
            'address.locality'           => ['nullable', 'string', 'max:100'],
            'address.administrative_area' => ['nullable', 'string', 'max:100'],
            'address.postal_code'        => ['nullable', 'string', 'max:30'],
            'address.dependent_locality' => ['nullable', 'string', 'max:100'],
            'address.sorting_code'       => ['nullable', 'string', 'max:30'],
            'address.latitude'           => ['nullable', 'numeric', 'between:-90,90'],
            'address.longitude'          => ['nullable', 'numeric', 'between:-180,180'],
        ];
    }
}
