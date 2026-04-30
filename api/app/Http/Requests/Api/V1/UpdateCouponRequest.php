<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCouponRequest extends FormRequest
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
        $orgId  = $this->route('organization')?->id;
        $coupon = $this->route('coupon');

        return [
            'code' => [
                'sometimes',
                'string',
                'max:50',
                'regex:/^[A-Z0-9\-]+$/',
                Rule::unique('coupons', 'code')
                    ->where('organization_id', $orgId)
                    ->ignore($coupon?->id),
            ],

            'label'       => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],

            'discount_type' => ['sometimes', 'in:percentage,fixed_amount,free'],

            'discount_pct' => [
                'sometimes',
                'nullable',
                'numeric',
                'between:0.01,99.99',
            ],

            'discount_amount_cents' => [
                'sometimes',
                'nullable',
                'integer',
                'min:1',
            ],

            'applies_to' => ['sometimes', 'in:all,workshop_only,addons_only'],

            'workshop_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('workshops', 'id')->where('organization_id', $orgId),
            ],

            'minimum_order_cents'    => ['sometimes', 'nullable', 'integer', 'min:0'],
            'max_redemptions'        => ['sometimes', 'nullable', 'integer', 'min:1'],
            'max_redemptions_per_user' => ['sometimes', 'integer', 'min:1'],
            'is_active'              => ['sometimes', 'boolean'],
            'valid_from'             => ['sometimes', 'nullable', 'date'],
            'valid_until'            => ['sometimes', 'nullable', 'date', 'after_or_equal:valid_from'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $coupon = $this->route('coupon');

            if (! $coupon || ! $coupon->redemptions()->exists()) {
                return;
            }

            // Immutable fields once redemptions exist.
            if ($this->filled('code') && $this->input('code') !== $coupon->code) {
                $validator->errors()->add(
                    'code',
                    'This coupon has been used and its code cannot be changed.'
                );
            }

            if ($this->filled('discount_type') && $this->input('discount_type') !== $coupon->discount_type) {
                $validator->errors()->add(
                    'discount_type',
                    'This coupon has been used and its discount type cannot be changed.'
                );
            }

            if ($this->filled('discount_pct') && (float) $this->input('discount_pct') !== (float) $coupon->discount_pct) {
                $validator->errors()->add(
                    'discount_pct',
                    'This coupon has been used and its discount amount cannot be changed.'
                );
            }

            if ($this->filled('discount_amount_cents') && (int) $this->input('discount_amount_cents') !== (int) $coupon->discount_amount_cents) {
                $validator->errors()->add(
                    'discount_amount_cents',
                    'This coupon has been used and its discount amount cannot be changed.'
                );
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
