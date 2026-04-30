<?php

namespace App\Domain\Payments\Models;

use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\Workshop;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'item_type',
        'workshop_id',
        'session_id',
        'registration_id',
        'session_selection_id',
        'unit_price_cents',
        'applied_tier_id',
        'applied_tier_label',
        'is_tier_price',
        'quantity',
        'line_total_cents',
        'is_deposit',
        'refunded_amount_cents',
        'refund_status',
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
        'refunded_amount_cents' => 'integer',
        'metadata_json' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(Session::class);
    }

    public function registration(): BelongsTo
    {
        return $this->belongsTo(Registration::class);
    }

    public function sessionSelection(): BelongsTo
    {
        return $this->belongsTo(SessionSelection::class);
    }

    public function appliedTier(): BelongsTo
    {
        return $this->belongsTo(WorkshopPriceTier::class, 'applied_tier_id');
    }
}
