<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoginEvent extends Model
{
    // Immutable audit record — no updated_at
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'email_attempted',
        'ip_address',
        'user_agent',
        'platform',
        'success',
        'failure_reason',
    ];

    protected $casts = [
        'success' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
