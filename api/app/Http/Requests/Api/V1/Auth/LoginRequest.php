<?php

namespace App\Http\Requests\Api\V1\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email'       => ['required', 'email'],
            'password'    => ['required', 'string'],
            'platform'    => ['sometimes', 'string', 'in:web,ios,android,unknown'],
            'device_name' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
