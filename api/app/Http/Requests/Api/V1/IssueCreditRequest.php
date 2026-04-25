<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class IssueCreditRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'amount_cents' => ['required', 'integer', 'min:1'],
            'expiry_days'  => ['nullable', 'integer', 'min:1', 'max:730'],
        ];
    }
}
