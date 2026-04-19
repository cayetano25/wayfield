<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CreateSessionLeaderNotificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Fine-grained authorization is handled in the controller via Policy.
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:500'],
            'notification_type' => ['required', 'string', 'in:informational,urgent,reminder'],
        ];
    }
}
