<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminLoginEvent extends Model
{
    // Append-only security log — no updated_at
    public const UPDATED_AT = null;

    protected $fillable = [
        'admin_user_id',
        'email_attempted',
        'outcome',
        'ip_address',
        'user_agent',
    ];

    public function adminUser(): BelongsTo
    {
        return $this->belongsTo(AdminUser::class, 'admin_user_id');
    }
}
