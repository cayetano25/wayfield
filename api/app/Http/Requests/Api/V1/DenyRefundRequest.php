<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class DenyRefundRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'review_notes' => ['required', 'string', 'min:10', 'max:2000'],
        ];
    }
}
