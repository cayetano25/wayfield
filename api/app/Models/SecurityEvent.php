<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SecurityEvent extends Model
{
    // Immutable audit record — no updated_at
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'organization_id',
        'event_type',
        'ip_address',
        'user_agent',
        'metadata_json',
        'severity',
    ];

    protected $casts = [
        'metadata_json' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
