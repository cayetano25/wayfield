<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTwoFactorRecoveryCode extends Model
{
    protected $table = 'user_2fa_recovery_codes';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'code_hash',
        'used_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'used_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
