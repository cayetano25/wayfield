<?php

namespace App\Domain\Payments\Models;

use App\Models\Workshop;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkshopPricing extends Model
{
    protected $table = 'workshop_pricing';

    protected $fillable = [
        'workshop_id',
        'base_price_cents',
        'currency',
        'is_paid',
        'deposit_enabled',
        'deposit_amount_cents',
        'deposit_is_nonrefundable',
        'balance_due_date',
        'balance_auto_charge',
        'balance_reminder_days',
        'minimum_attendance',
        'commitment_date',
        'commitment_description',
        'commitment_reminder_days',
        'post_commitment_refund_pct',
        'post_commitment_refund_note',
    ];

    protected $casts = [
        'base_price_cents' => 'integer',
        'is_paid' => 'boolean',
        'deposit_enabled' => 'boolean',
        'deposit_amount_cents' => 'integer',
        'deposit_is_nonrefundable' => 'boolean',
        'balance_due_date' => 'date',
        'balance_auto_charge' => 'boolean',
        'balance_reminder_days' => 'array',
        'commitment_date' => 'date',
        'commitment_reminder_days' => 'array',
        'post_commitment_refund_pct' => 'float',
    ];

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function isFree(): bool
    {
        return $this->base_price_cents === 0;
    }

    public function hasDeposit(): bool
    {
        return $this->deposit_enabled && $this->deposit_amount_cents > 0;
    }

    public function getFormattedBasePrice(): string
    {
        return '$' . number_format($this->base_price_cents / 100, 2);
    }

    public function getFormattedDepositAmount(): string
    {
        return '$' . number_format(($this->deposit_amount_cents ?? 0) / 100, 2);
    }
}
