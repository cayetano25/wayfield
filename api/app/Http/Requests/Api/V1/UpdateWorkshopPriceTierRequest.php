<?php

namespace App\Http\Requests\Api\V1;

use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Models\Workshop;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateWorkshopPriceTierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'label'          => ['sometimes', 'string', 'max:100'],
            'price_cents'    => ['sometimes', 'integer', 'min:1'],
            'valid_from'     => ['nullable', 'date'],
            'valid_until'    => ['nullable', 'date'],
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

            /** @var WorkshopPriceTier $tier */
            $tier = $this->route('tier');

            // price_cents cannot change once registrations have used this tier.
            if ($this->filled('price_cents') && $tier->registrations_at_tier > 0) {
                if ((int) $this->input('price_cents') !== $tier->price_cents) {
                    $v->errors()->add(
                        'price_cents',
                        'This tier has already been used and its price cannot be changed. '
                        . 'Create a new tier or adjust the existing one\'s date/capacity limits.'
                    );
                }
            }

            $pricing = WorkshopPricing::where('workshop_id', $workshop->id)->first();

            // price_cents must not exceed base price (only if changing it).
            if ($pricing !== null && $this->filled('price_cents') && $tier->registrations_at_tier === 0) {
                $priceCents = (int) $this->input('price_cents');
                if ($priceCents > $pricing->base_price_cents) {
                    $formatted = '$' . number_format($pricing->base_price_cents / 100, 2);
                    $v->errors()->add(
                        'price_cents',
                        "Tier price cannot exceed the workshop's base price of {$formatted}."
                    );
                }
            }

            // valid_until must be before workshop start_date when provided.
            if ($this->filled('valid_until') && $workshop->start_date !== null) {
                $validUntil = \Carbon\Carbon::parse($this->input('valid_until'));
                if ($validUntil->gte($workshop->start_date)) {
                    $v->errors()->add('valid_until', 'Tier must expire before the workshop begins.');
                }
            }

            // Confirm the resulting state has at least one boundary (valid_until OR capacity_limit).
            // Consider both what's in the request and what's already on the tier.
            $effectiveValidUntil    = $this->has('valid_until')   ? $this->input('valid_until')   : $tier->valid_until;
            $effectiveCapacityLimit = $this->has('capacity_limit') ? $this->input('capacity_limit') : $tier->capacity_limit;

            if ($effectiveValidUntil === null && $effectiveCapacityLimit === null) {
                $v->errors()->add(
                    'valid_until',
                    'A tier must have either an expiry date or a capacity limit so it eventually gives way to the next pricing level.'
                );
            }
        });
    }
}
