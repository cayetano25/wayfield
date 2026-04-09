<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WebhookEndpoint extends Model
{
    protected $fillable = [
        'organization_id',
        'url',
        'secret_encrypted',
        'description',
        'is_active',
        'event_types',
        'failure_count',
        'last_success_at',
        'last_failure_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'event_types' => 'array',
        'failure_count' => 'integer',
        'last_success_at' => 'datetime',
        'last_failure_at' => 'datetime',
    ];

    protected $hidden = [
        'secret_encrypted',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(WebhookDelivery::class);
    }

    public function isSubscribedTo(string $eventType): bool
    {
        return in_array($eventType, $this->event_types ?? [], true);
    }
}
