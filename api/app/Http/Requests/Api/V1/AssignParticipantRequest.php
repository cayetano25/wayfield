<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class AssignParticipantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Authorization handled in controller via policy
    }

    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'assignment_notes' => ['nullable', 'string', 'max:500'],
            'force_assign' => ['nullable', 'boolean'],
            'notify_participant' => ['nullable', 'boolean'],
        ];
    }

    public function validated($key = null, $default = null): mixed
    {
        $data = parent::validated($key, $default);

        if (is_array($data)) {
            $data['force_assign'] = (bool) ($data['force_assign'] ?? false);
            $data['notify_participant'] = (bool) ($data['notify_participant'] ?? false);
        }

        return $data;
    }
}
