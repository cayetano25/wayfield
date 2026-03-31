<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CreateOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'                       => ['required', 'string', 'max:255'],
            'slug'                       => ['sometimes', 'nullable', 'string', 'max:255', 'unique:organizations,slug', 'regex:/^[a-z0-9\-]+$/'],
            'primary_contact_first_name' => ['required', 'string', 'max:100'],
            'primary_contact_last_name'  => ['required', 'string', 'max:100'],
            'primary_contact_email'      => ['required', 'email', 'max:255'],
            'primary_contact_phone'      => ['sometimes', 'nullable', 'string', 'max:50'],
        ];
    }
}
