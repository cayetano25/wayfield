<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateOrganizationUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'role' => ['sometimes', 'required', 'string', 'in:owner,admin,staff,billing_admin'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
