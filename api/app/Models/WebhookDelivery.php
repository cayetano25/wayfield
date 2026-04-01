<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebhookDelivery extends Model
{
    protected $fillable = [
        'organization_id',
        'webhook_url',
        'event_type',
        'payload_json',
        'response_status',
        'response_body',
        'attempt_count',
        'last_attempted_at',
        'delivered_at',
    ];

    protected $casts = [
        'payload_json'      => 'array',
        'last_attempted_at' => 'datetime',
        'delivered_at'      => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function isDelivered(): bool
    {
        return $this->delivered_at !== null;
    }
}
