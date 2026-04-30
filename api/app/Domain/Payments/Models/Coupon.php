<?php

namespace App\Domain\Payments\Models;

use App\Models\Organization;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Coupon extends Model
{
    protected $fillable = [
        'organization_id',
        'workshop_id',
        'created_by_user_id',
        'code',
        'label',
        'description',
        'discount_type',
        'discount_pct',
        'discount_amount_cents',
        'applies_to',
        'minimum_order_cents',
        'max_redemptions',
        'max_redemptions_per_user',
        'is_active',
        'valid_from',
        'valid_until',
    ];

    protected $casts = [
        'discount_pct' => 'float',
        'is_active' => 'boolean',
        'valid_from' => 'datetime',
        'valid_until' => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(CouponRedemption::class);
    }

    public function isValid(): bool
    {
        return $this->is_active
            && ($this->valid_from === null || $this->valid_from->lte(now()))
            && ($this->valid_until === null || $this->valid_until->gte(now()));
    }

    public function isUsageLimitReached(): bool
    {
        return $this->max_redemptions !== null
            && $this->redemption_count >= $this->max_redemptions;
    }

    public function hasUserExceededLimit(int $userId): bool
    {
        return $this->redemptions()->where('user_id', $userId)->count() >= $this->max_redemptions_per_user;
    }

    public function calculateDiscount(int $applicableSubtotalCents): int
    {
        return match ($this->discount_type) {
            'percentage' => (int) floor($applicableSubtotalCents * $this->discount_pct / 100),
            'fixed_amount' => min($this->discount_amount_cents, $applicableSubtotalCents),
            'free' => $applicableSubtotalCents,
        };
    }

    public function getFormattedDiscount(): string
    {
        return match ($this->discount_type) {
            'percentage' => rtrim(rtrim(number_format($this->discount_pct, 2), '0'), '.') . '% off',
            'fixed_amount' => '$' . number_format($this->discount_amount_cents / 100, 2) . ' off',
            'free' => 'Free',
        };
    }

    public function scopeActiveForOrg(Builder $query, int $orgId): Builder
    {
        return $query->where('organization_id', $orgId)->where('is_active', true);
    }

    // Always store codes as uppercase — ensures case-insensitive lookup works
    // via a simple WHERE code = ? after strtoupper() on the input.
    public function setCodeAttribute(string $value): void
    {
        $this->attributes['code'] = strtoupper(trim($value));
    }
}
