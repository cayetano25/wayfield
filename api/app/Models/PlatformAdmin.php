<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformAdmin extends Model
{
    protected $fillable = [
        'user_id',
        'role',
        'is_active',
        'notes',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    public function canAccessFinancials(): bool
    {
        return in_array($this->role, ['super_admin', 'finance']);
    }

    public function canAccessSupport(): bool
    {
        return in_array($this->role, ['super_admin', 'support', 'ops']);
    }
}
