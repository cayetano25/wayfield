<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCouponRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Auth enforced in controller
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => strtoupper(trim($this->input('code', '')))]);
        }
    }

    public function rules(): array
    {
        $orgId = $this->route('organization')?->id;

        return [
            'code' => [
                'required',
                'string',
                'max:50',
                'regex:/^[A-Z0-9\-]+$/',
                Rule::unique('coupons', 'code')->where('organization_id', $orgId),
            ],

            'label'       => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],

            'discount_type' => ['required', 'in:percentage,fixed_amount,free'],

            'discount_pct' => [
                'nullable',
                'required_if:discount_type,percentage',
                'numeric',
                'between:0.01,99.99',
            ],

            'discount_amount_cents' => [
                'nullable',
                'required_if:discount_type,fixed_amount',
                'integer',
                'min:1',
            ],

            'applies_to' => ['nullable', 'in:all,workshop_only,addons_only'],

            'workshop_id' => [
                'nullable',
                'integer',
                Rule::exists('workshops', 'id')->where('organization_id', $orgId),
            ],

            'minimum_order_cents'    => ['nullable', 'integer', 'min:0'],
            'max_redemptions'        => ['nullable', 'integer', 'min:1'],
            'max_redemptions_per_user' => ['nullable', 'integer', 'min:1'],
            'is_active'              => ['nullable', 'boolean'],
            'valid_from'             => ['nullable', 'date'],
            'valid_until'            => ['nullable', 'date', 'after_or_equal:valid_from'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $type = $this->input('discount_type');

            if ($type === 'percentage' && $this->filled('discount_amount_cents')) {
                $validator->errors()->add('discount_amount_cents', 'discount_amount_cents must be absent for percentage discounts.');
            }

            if ($type === 'fixed_amount' && $this->filled('discount_pct')) {
                $validator->errors()->add('discount_pct', 'discount_pct must be absent for fixed_amount discounts.');
            }

            if ($type === 'free') {
                if ($this->filled('discount_pct')) {
                    $validator->errors()->add('discount_pct', 'discount_pct must be absent for free discounts.');
                }
                if ($this->filled('discount_amount_cents')) {
                    $validator->errors()->add('discount_amount_cents', 'discount_amount_cents must be absent for free discounts.');
                }
            }
        });
    }

    public function messages(): array
    {
        return [
            'code.unique' => 'A coupon with this code already exists for your organization.',
            'code.regex'  => 'Coupon codes may only contain letters, numbers, and hyphens.',
        ];
    }
}
