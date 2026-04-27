<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Session;
use Illuminate\Foundation\Http\FormRequest;

class StoreSessionPricingRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'price_cents'     => ['required', 'integer', 'min:0'],
            'is_nonrefundable' => ['boolean'],
            'max_purchases'   => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $session = $this->route('session');

            if (! $session instanceof Session) {
                return;
            }

            $allowedTypes = ['addon', 'invite_only'];

            if (! in_array($session->session_type, $allowedTypes, true)) {
                $validator->errors()->add(
                    'session',
                    'Pricing can only be set on add-on or invite-only sessions.',
                );
            }
        });
    }
}
