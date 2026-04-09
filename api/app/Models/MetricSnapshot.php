<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MetricSnapshot extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'metric_key',
        'granularity',
        'period_start',
        'period_end',
        'value',
        'organization_id',
        'metadata_json',
        'computed_at',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'value' => 'decimal:4',
        'metadata_json' => 'array',
        'computed_at' => 'datetime',
    ];
}
