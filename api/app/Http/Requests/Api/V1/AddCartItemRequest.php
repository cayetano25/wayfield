<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class AddCartItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'item_type'   => ['required', 'string', 'in:workshop_registration,addon_session'],
            'workshop_id' => ['nullable', 'integer', 'exists:workshops,id'],
            'session_id'  => ['nullable', 'integer', 'exists:sessions,id'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($v) {
            $type = $this->input('item_type');

            if ($type === 'workshop_registration' && ! $this->input('workshop_id')) {
                $v->errors()->add('workshop_id', 'workshop_id is required for workshop_registration items.');
            }

            if ($type === 'addon_session' && ! $this->input('session_id')) {
                $v->errors()->add('session_id', 'session_id is required for addon_session items.');
            }
        });
    }
}
