<?php

namespace App\Domain\Payments\Models;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cart extends Model
{
    protected $fillable = [
        'user_id',
        'organization_id',
        'status',
        'stripe_account_id',
        'subtotal_cents',
        'currency',
        'applied_coupon_id',
        'coupon_code_applied',
        'discount_cents',
        'discounted_total_cents',
        'expires_at',
        'last_activity_at',
    ];

    protected $casts = [
        'subtotal_cents' => 'integer',
        'discount_cents' => 'integer',
        'discounted_total_cents' => 'integer',
        'expires_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'checked_out_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(CartItem::class);
    }

    public function appliedCoupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class, 'applied_coupon_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active' && $this->expires_at->isFuture();
    }

    public function getFormattedTotal(): string
    {
        return '$' . number_format($this->subtotal_cents / 100, 2);
    }

    public function getFormattedDiscount(): ?string
    {
        if ($this->applied_coupon_id === null) {
            return null;
        }

        return '-$' . number_format($this->discount_cents / 100, 2);
    }

    public function getDiscountedTotal(): int
    {
        return $this->discounted_total_cents;
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }
}
