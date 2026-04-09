<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UsageSnapshot extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'organization_id',
        'snapshot_type',
        'period_start',
        'period_end',
        'metrics_json',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'metrics_json' => 'array',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
