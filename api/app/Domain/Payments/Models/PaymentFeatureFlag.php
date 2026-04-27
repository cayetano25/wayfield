<?php

namespace App\Domain\Payments\Models;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentFeatureFlag extends Model
{
    protected $fillable = [
        'scope',
        'organization_id',
        'flag_key',
        'is_enabled',
        'enabled_at',
        'enabled_by_user_id',
        'notes',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'enabled_at' => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function scopePlatform(Builder $query): Builder
    {
        return $query->where('scope', 'platform');
    }

    public function scopeForOrg(Builder $query, int $orgId): Builder
    {
        return $query->where('scope', 'organization')->where('organization_id', $orgId);
    }
}
