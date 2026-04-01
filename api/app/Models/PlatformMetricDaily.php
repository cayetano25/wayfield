<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlatformMetricDaily extends Model
{
    protected $table = 'platform_metrics_daily';

    protected $fillable = [
        'date',
        'active_organizations',
        'active_workshops',
        'total_registrations',
        'total_notifications_sent',
        'new_signups',
        'revenue_cents',
    ];

    protected $casts = [
        'date' => 'date',
    ];
}
