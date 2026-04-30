<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'required', 'string', 'max:100'],
            'logo_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'primary_color' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'primary_contact_first_name' => ['sometimes', 'required', 'string', 'max:100'],
            'primary_contact_last_name' => ['sometimes', 'required', 'string', 'max:100'],
            'primary_contact_email' => ['sometimes', 'required', 'email', 'max:255'],
            'primary_contact_phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            // Structured address (Phase 16) — internal/billing use only, never public
            'address' => ['sometimes', 'nullable', 'array'],
            'address.country_code' => ['required_with:address', 'size:2'],
            'address.address_line_1' => ['required_with:address', 'string', 'max:255'],
            'address.address_line_2' => ['nullable', 'string', 'max:255'],
            'address.address_line_3' => ['nullable', 'string', 'max:255'],
            'address.locality' => ['nullable', 'string', 'max:100'],
            'address.administrative_area' => ['nullable', 'string', 'max:100'],
            'address.postal_code' => ['nullable', 'string', 'max:30'],
            'address.dependent_locality' => ['nullable', 'string', 'max:100'],
            'address.sorting_code' => ['nullable', 'string', 'max:30'],
        ];
    }
}
