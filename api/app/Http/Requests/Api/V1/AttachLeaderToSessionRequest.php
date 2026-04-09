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
            'leader_id' => ['required', 'integer', 'exists:leaders,id'],
            'role_label' => ['nullable', 'string', 'max:100'],
            'role_in_session' => ['sometimes', 'string', 'in:primary_leader,co_leader,panelist,moderator,assistant'],
            'is_primary' => ['sometimes', 'boolean'],
            'assignment_status' => ['sometimes', 'string', 'in:pending,accepted,declined,removed'],
        ];
    }
}
