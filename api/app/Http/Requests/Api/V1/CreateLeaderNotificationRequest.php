<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CreateLeaderNotificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Fine-grained authorization is handled in the controller via Policy.
        return true;
    }

    public function rules(): array
    {
        return [
            'session_id' => ['required', 'integer', 'exists:sessions,id'],
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string'],
            'notification_type' => ['sometimes', 'string', 'in:informational,urgent,reminder'],
        ];
    }
}
