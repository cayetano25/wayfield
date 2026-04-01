<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantMetricDaily extends Model
{
    protected $table = 'tenant_metrics_daily';

    protected $fillable = [
        'organization_id',
        'date',
        'active_workshops',
        'total_participants',
        'total_sessions',
        'notifications_sent',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
