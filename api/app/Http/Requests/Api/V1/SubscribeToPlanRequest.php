<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SubscribeToPlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'plan_code'         => ['required', Rule::in(['creator', 'studio'])],
            'interval'          => ['required', Rule::in(['monthly', 'annual'])],
            'payment_method_id' => ['required', 'string'],
        ];
    }
}
