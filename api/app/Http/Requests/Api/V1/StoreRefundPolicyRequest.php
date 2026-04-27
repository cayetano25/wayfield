<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRefundPolicyRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'scope'                       => ['required', Rule::in(['organization', 'workshop'])],
            'full_refund_cutoff_days'     => ['required', 'integer', 'min:0'],
            'partial_refund_cutoff_days'  => [
                'required',
                'integer',
                'min:0',
                'lte:full_refund_cutoff_days',
            ],
            'partial_refund_pct'          => ['required', 'numeric', 'between:0,100'],
            'no_refund_cutoff_hours'      => ['required', 'integer', 'min:0'],
            'wayfield_fee_refundable'     => ['boolean'],
            'allow_credits'               => ['boolean'],
            'credit_expiry_days'          => ['nullable', 'integer', 'min:30'],
            'custom_policy_text'          => ['nullable', 'string', 'max:2000'],
        ];
    }
}
