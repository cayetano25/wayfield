<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    // audit_logs has no updated_at column by design
    public const UPDATED_AT = null;

    protected $fillable = [
        'organization_id',
        'actor_user_id',
        'entity_type',
        'entity_id',
        'action',
        'metadata_json',
    ];

    protected $casts = [
        'metadata_json' => 'array',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
