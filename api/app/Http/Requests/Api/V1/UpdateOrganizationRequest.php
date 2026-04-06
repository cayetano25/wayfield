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
            'name'                       => ['sometimes', 'required', 'string', 'max:255'],
            'slug'                       => ['sometimes', 'required', 'string', 'max:100'],
            'logo_url'                   => ['sometimes', 'nullable', 'string', 'max:2048'],
            'primary_contact_first_name' => ['sometimes', 'required', 'string', 'max:100'],
            'primary_contact_last_name'  => ['sometimes', 'required', 'string', 'max:100'],
            'primary_contact_email'      => ['sometimes', 'required', 'email', 'max:255'],
            'primary_contact_phone'      => ['sometimes', 'nullable', 'string', 'max:50'],
        ];
    }
}
