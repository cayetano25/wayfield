<?php

namespace App\Domain\Payments\Models;

use App\Models\Organization;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CouponRedemption extends Model
{
    // Immutable record — no updated_at column.
    const UPDATED_AT = null;

    protected $fillable = [
        'coupon_id',
        'order_id',
        'user_id',
        'organization_id',
        'workshop_id',
        'discount_amount_cents',
        'pre_discount_subtotal_cents',
        'post_discount_total_cents',
        'coupon_code_snapshot',
        'discount_type_snapshot',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }
}
