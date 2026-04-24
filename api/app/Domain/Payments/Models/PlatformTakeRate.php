<?php

namespace App\Domain\Payments\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class PlatformTakeRate extends Model
{
    protected $fillable = [
        'plan_code',
        'take_rate_pct',
        'is_active',
        'notes',
    ];

    protected $casts = [
        'take_rate_pct' => 'float',
        'is_active' => 'boolean',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
