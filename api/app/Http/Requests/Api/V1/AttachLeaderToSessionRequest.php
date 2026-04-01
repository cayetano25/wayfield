<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class AttachLeaderToSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'leader_id'  => ['required', 'integer', 'exists:leaders,id'],
            'role_label' => ['nullable', 'string', 'max:100'],
        ];
    }
}
