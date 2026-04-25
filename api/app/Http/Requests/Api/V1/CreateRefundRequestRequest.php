<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateRefundRequestRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'reason_code'            => ['required', 'string', Rule::in([
                'cancellation',
                'schedule_conflict',
                'dissatisfied',
                'medical',
                'organizer_cancelled',
                'other',
            ])],
            'reason_text'            => ['nullable', 'string', 'max:2000'],
            'requested_amount_cents' => ['required', 'integer', 'min:1'],
            'order_item_id'          => ['nullable', 'integer', 'exists:order_items,id'],
        ];
    }
}
