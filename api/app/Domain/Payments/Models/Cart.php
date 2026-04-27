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
        'expires_at',
        'last_activity_at',
    ];

    protected $casts = [
        'subtotal_cents' => 'integer',
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

    public function isActive(): bool
    {
        return $this->status === 'active' && $this->expires_at->isFuture();
    }

    public function getFormattedTotal(): string
    {
        return '$' . number_format($this->subtotal_cents / 100, 2);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }
}
