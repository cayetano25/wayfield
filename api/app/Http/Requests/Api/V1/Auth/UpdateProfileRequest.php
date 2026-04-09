<?php

namespace App\Http\Requests\Api\V1\Auth;

use App\Services\Address\AddressService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Handles Step 2 of onboarding — pronouns, phone, timezone, and optional address.
 * All fields are optional. Never blocks progression.
 */
class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'pronouns' => ['nullable', 'string', 'max:50'],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'timezone' => ['nullable', 'string', 'max:100', Rule::in(timezone_identifiers_list())],

            // Address — only validated if any address key is present
            'address' => ['nullable', 'array'],
            'address.country_code' => ['required_with:address', 'string', 'size:2'],
            'address.address_line_1' => ['required_with:address', 'string', 'max:255'],
            'address.address_line_2' => ['nullable', 'string', 'max:255'],
            'address.locality' => ['nullable', 'string', 'max:100'],
            'address.administrative_area' => ['nullable', 'string', 'max:100'],
            'address.postal_code' => ['nullable', 'string', 'max:30'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($v) {
            $data = $v->getData();

            if (empty($data['address'])) {
                return;
            }

            $postalCode = $data['address']['postal_code'] ?? null;
            $countryCode = $data['address']['country_code'] ?? null;

            if ($postalCode && $countryCode) {
                $valid = app(AddressService::class)
                    ->validatePostalCode($postalCode, $countryCode);

                if (! $valid) {
                    $countryName = config("address_countries.{$countryCode}.name")
                        ?? $countryCode;

                    $v->errors()->add(
                        'address.postal_code',
                        "The postal code format is invalid for {$countryName}."
                    );
                }
            }
        });
    }
}
