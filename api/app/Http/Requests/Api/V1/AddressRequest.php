<?php

namespace App\Http\Requests\Api\V1;

use App\Services\Address\AddressService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'country_code' => ['required', 'size:2', Rule::in(array_keys(config('address_countries')))],
            'address_line_1' => ['required', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'address_line_3' => ['nullable', 'string', 'max:255'],
            'locality' => ['nullable', 'string', 'max:100'],
            'administrative_area' => ['nullable', 'string', 'max:100'],
            'postal_code' => ['nullable', 'string', 'max:30'],
            'dependent_locality' => ['nullable', 'string', 'max:100'],
            'sorting_code' => ['nullable', 'string', 'max:30'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($v) {
            $data = $v->getData();

            if (! empty($data['postal_code']) && ! empty($data['country_code'])) {
                $valid = app(AddressService::class)
                    ->validatePostalCode($data['postal_code'], $data['country_code']);

                if (! $valid) {
                    $countryName = config("address_countries.{$data['country_code']}.name")
                        ?? $data['country_code'];

                    $v->errors()->add('postal_code',
                        "The postal code format is invalid for {$countryName}.");
                }
            }
        });
    }
}
