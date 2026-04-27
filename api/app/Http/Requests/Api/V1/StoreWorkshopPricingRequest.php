<?php

namespace App\Http\Requests\Api\V1;

use App\Domain\Payments\Services\PaymentFeatureFlagService;
use App\Models\Workshop;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWorkshopPricingRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'base_price_cents'             => ['required', 'integer', 'min:0'],
            'is_paid'                      => ['required', 'boolean'],
            'deposit_enabled'              => ['boolean'],
            'deposit_amount_cents'         => [
                Rule::requiredIf($this->boolean('deposit_enabled')),
                'nullable',
                'integer',
                'min:100',
            ],
            'deposit_is_nonrefundable'     => ['boolean'],
            'balance_due_date'             => [
                Rule::requiredIf($this->boolean('deposit_enabled')),
                'nullable',
                'date',
                'after:today',
            ],
            'balance_auto_charge'          => ['boolean'],
            'balance_reminder_days'        => ['nullable', 'array'],
            'balance_reminder_days.*'      => ['integer', Rule::in([1, 3, 7, 14, 30])],
            'minimum_attendance'           => ['nullable', 'integer', 'min:1'],
            'commitment_date'              => ['nullable', 'date', 'after:today'],
            'commitment_description'       => ['nullable', 'string', 'max:500'],
            'commitment_reminder_days'     => ['nullable', 'array'],
            'commitment_reminder_days.*'   => ['integer', Rule::in([1, 3, 7, 14, 30])],
            'post_commitment_refund_pct'   => ['nullable', 'numeric', 'between:0,100'],
            'post_commitment_refund_note'  => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $workshop = $this->route('workshop');

            if (! $workshop instanceof Workshop) {
                return;
            }

            $depositEnabled = $this->boolean('deposit_enabled');

            if ($depositEnabled) {
                // Deposit requires Creator/Studio plan
                $flags = app(PaymentFeatureFlagService::class);
                if (! $flags->isDepositsEnabled($workshop->organization_id)) {
                    $validator->errors()->add(
                        'deposit_enabled',
                        'Deposit payments require a Creator or Studio subscription.',
                    );
                }

                // deposit_amount_cents must be less than base_price_cents
                $depositAmount = (int) $this->input('deposit_amount_cents', 0);
                $basePrice     = (int) $this->input('base_price_cents', 0);

                if ($depositAmount >= $basePrice) {
                    $validator->errors()->add(
                        'deposit_amount_cents',
                        'Deposit amount must be less than the base price.',
                    );
                }

                // balance_due_date must be at least 1 day before workshop.start_date
                $balanceDueDate = $this->input('balance_due_date');

                if ($balanceDueDate) {
                    $due   = \Carbon\Carbon::parse($balanceDueDate);
                    $start = \Carbon\Carbon::parse($workshop->start_date);

                    if ($due->gte($start)) {
                        $validator->errors()->add(
                            'balance_due_date',
                            'Balance due date must be at least one day before the workshop start date.',
                        );
                    }
                }

                // commitment_date must be before balance_due_date
                $commitmentDate = $this->input('commitment_date');

                if ($commitmentDate && $balanceDueDate) {
                    $commit  = \Carbon\Carbon::parse($commitmentDate);
                    $balance = \Carbon\Carbon::parse($balanceDueDate);

                    if ($commit->gte($balance)) {
                        $validator->errors()->add(
                            'commitment_date',
                            'Commitment date must be before the balance due date.',
                        );
                    }
                }
            }

            // commitment_date must be before workshop start_date (regardless of deposit)
            $commitmentDate = $this->input('commitment_date');

            if ($commitmentDate) {
                $commit = \Carbon\Carbon::parse($commitmentDate);
                $start  = \Carbon\Carbon::parse($workshop->start_date);

                if ($commit->gte($start)) {
                    $validator->errors()->add(
                        'commitment_date',
                        'Commitment date must be before the workshop start date.',
                    );
                }
            }
        });
    }
}
