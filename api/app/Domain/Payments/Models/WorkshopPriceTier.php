<?php

namespace App\Domain\Payments\Models;

use App\Domain\Payments\Services\FeeCalculationService;
use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkshopPriceTier extends Model
{
    protected $fillable = [
        'workshop_id',
        'label',
        'price_cents',
        'valid_from',
        'valid_until',
        'capacity_limit',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'price_cents' => 'integer',
        'capacity_limit' => 'integer',
        'registrations_at_tier' => 'integer',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
        'valid_from' => 'datetime',
        'valid_until' => 'datetime',
        'reminder_sent_at' => 'datetime',
    ];

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function cartItems(): HasMany
    {
        return $this->hasMany(CartItem::class, 'applied_tier_id');
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'applied_tier_id');
    }

    public function isDateEligible(Carbon $at): bool
    {
        $fromOk = $this->valid_from === null || $this->valid_from->lte($at);
        $untilOk = $this->valid_until === null || $this->valid_until->gte($at);

        return $fromOk && $untilOk;
    }

    public function isCapacityEligible(int $currentRegistrationCount): bool
    {
        return $this->capacity_limit === null || $currentRegistrationCount < $this->capacity_limit;
    }

    public function isEligible(Carbon $at, int $currentRegistrationCount): bool
    {
        return $this->isDateEligible($at) && $this->isCapacityEligible($currentRegistrationCount);
    }

    public function getFormattedPrice(): string
    {
        return app(FeeCalculationService::class)->formatCents($this->price_cents);
    }

    public function getRemainingCapacity(int $currentRegistrationCount): ?int
    {
        if ($this->capacity_limit === null) {
            return null;
        }

        return max(0, $this->capacity_limit - $currentRegistrationCount);
    }

    public function scopeActiveForWorkshop(Builder $query, int $workshopId): Builder
    {
        return $query
            ->where('workshop_id', $workshopId)
            ->where('is_active', true)
            ->orderBy('sort_order');
    }
}
