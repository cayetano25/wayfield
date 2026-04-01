<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class InviteLeaderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Authorization handled in controller via policy
    }

    public function rules(): array
    {
        return [
            'invited_email'      => ['required', 'email', 'max:255'],
            'invited_first_name' => ['nullable', 'string', 'max:100'],
            'invited_last_name'  => ['nullable', 'string', 'max:100'],
            'workshop_id'        => ['nullable', 'integer', 'exists:workshops,id'],
        ];
    }
}
