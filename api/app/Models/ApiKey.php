<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApiKey extends Model
{
    // Valid scope constants
    public const SCOPE_WORKSHOPS_READ = 'workshops:read';

    public const SCOPE_SESSIONS_READ = 'sessions:read';

    public const SCOPE_LEADERS_READ = 'leaders:read';

    public const SCOPE_PARTICIPANTS_READ = 'participants:read';

    public const ALL_SCOPES = [
        self::SCOPE_WORKSHOPS_READ,
        self::SCOPE_SESSIONS_READ,
        self::SCOPE_LEADERS_READ,
        self::SCOPE_PARTICIPANTS_READ,
    ];

    protected $fillable = [
        'organization_id',
        'name',
        'key_prefix',
        'key_hash',
        'scopes',
        'is_active',
        'last_used_at',
        'expires_at',
        'created_by_user_id',
    ];

    protected $casts = [
        'scopes' => 'array',
        'is_active' => 'boolean',
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    protected $hidden = [
        'key_hash',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function hasScope(string $scope): bool
    {
        return in_array($scope, $this->scopes ?? [], true);
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
