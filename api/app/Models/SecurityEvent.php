<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SecurityEvent extends Model
{
    // Immutable audit record — no updated_at
    public const UPDATED_AT = null;

    protected $fillable = [
        'event_type',
        'severity',
        'user_id',
        'organization_id',
        'ip_address',
        'description',
        'metadata_json',
        'is_resolved',
        'resolved_at',
        'resolved_by_admin_id',
    ];

    protected $casts = [
        'metadata_json' => 'array',
        'is_resolved' => 'boolean',
        'resolved_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(AdminUser::class, 'resolved_by_admin_id');
    }
}
