<?php

namespace App\Http\Requests\Api\V1;

use App\Domain\Payments\Models\WorkshopPricing;
use App\Models\Workshop;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreWorkshopPriceTierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'label'          => ['required', 'string', 'max:100'],
            'price_cents'    => ['required', 'integer', 'min:1'],
            'valid_from'     => ['nullable', 'date'],
            'valid_until'    => ['nullable', 'date', 'after:valid_from'],
            'capacity_limit' => ['nullable', 'integer', 'min:1'],
            'sort_order'     => ['nullable', 'integer', 'min:0'],
            'is_active'      => ['boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            /** @var Workshop $workshop */
            $workshop = $this->route('workshop');

            $pricing = WorkshopPricing::where('workshop_id', $workshop->id)->first();

            // price_cents must not exceed base price.
            if ($pricing !== null && $this->filled('price_cents')) {
                $priceCents = (int) $this->input('price_cents');
                if ($priceCents > $pricing->base_price_cents) {
                    $formatted = '$' . number_format($pricing->base_price_cents / 100, 2);
                    $v->errors()->add(
                        'price_cents',
                        "Tier price cannot exceed the workshop's base price of {$formatted}."
                    );
                }
            }

            // valid_until must be before workshop start_date.
            if ($this->filled('valid_until') && $workshop->start_date !== null) {
                $validUntil = \Carbon\Carbon::parse($this->input('valid_until'));
                if ($validUntil->gte($workshop->start_date)) {
                    $v->errors()->add('valid_until', 'Tier must expire before the workshop begins.');
                }
            }

            // At least one of valid_until or capacity_limit must be set.
            if (! $this->filled('valid_until') && ! $this->filled('capacity_limit')) {
                $v->errors()->add(
                    'valid_until',
                    'A tier must have either an expiry date or a capacity limit so it eventually gives way to the next pricing level.'
                );
            }
        });
    }
}
