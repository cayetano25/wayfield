<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTierOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tiers'              => ['required', 'array', 'min:1'],
            'tiers.*.id'         => ['required', 'integer'],
            'tiers.*.sort_order' => ['required', 'integer', 'min:0'],
        ];
    }
}
