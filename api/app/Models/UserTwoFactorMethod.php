<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTwoFactorMethod extends Model
{
    protected $table = 'user_2fa_methods';

    protected $fillable = [
        'user_id',
        'method_type',
        'secret_encrypted',
        'is_enabled',
        'last_used_at',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled'   => 'boolean',
            'last_used_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
