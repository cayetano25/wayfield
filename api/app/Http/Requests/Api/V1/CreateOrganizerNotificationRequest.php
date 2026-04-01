<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CreateOrganizerNotificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title'             => ['required', 'string', 'max:255'],
            'message'           => ['required', 'string'],
            'notification_type' => ['sometimes', 'string', 'in:informational,urgent,reminder'],
            'delivery_scope'    => ['required', 'string', 'in:all_participants,leaders,session_participants'],
            // session_id required when targeting session_participants
            'session_id'        => ['nullable', 'integer', 'exists:sessions,id'],
        ];
    }

    public function withValidator(\Illuminate\Validation\Validator $validator): void
    {
        $validator->sometimes('session_id', 'required', function ($input) {
            return $input->delivery_scope === 'session_participants';
        });
    }
}
