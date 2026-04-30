<?php

namespace App\Domain\Payments\Models;

use App\Models\Session;
use App\Models\Workshop;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CartItem extends Model
{
    protected $fillable = [
        'cart_id',
        'item_type',
        'workshop_id',
        'session_id',
        'unit_price_cents',
        'applied_tier_id',
        'applied_tier_label',
        'is_tier_price',
        'quantity',
        'line_total_cents',
        'is_deposit',
        'deposit_amount_cents',
        'balance_amount_cents',
        'balance_due_date',
        'currency',
        'metadata_json',
    ];

    protected $casts = [
        'unit_price_cents' => 'integer',
        'applied_tier_id' => 'integer',
        'is_tier_price' => 'boolean',
        'quantity' => 'integer',
        'line_total_cents' => 'integer',
        'is_deposit' => 'boolean',
        'deposit_amount_cents' => 'integer',
        'balance_amount_cents' => 'integer',
        'balance_due_date' => 'date',
        'metadata_json' => 'array',
    ];

    public function cart(): BelongsTo
    {
        return $this->belongsTo(Cart::class);
    }

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(Session::class);
    }

    public function appliedTier(): BelongsTo
    {
        return $this->belongsTo(WorkshopPriceTier::class, 'applied_tier_id');
    }

    public function getFormattedLineTotal(): string
    {
        return '$' . number_format($this->line_total_cents / 100, 2);
    }
}
