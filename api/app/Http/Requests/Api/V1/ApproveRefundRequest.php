<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class ApproveRefundRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'approved_amount_cents' => ['nullable', 'integer', 'min:1'],
            'review_notes'          => ['nullable', 'string', 'max:2000'],
        ];
    }
}
