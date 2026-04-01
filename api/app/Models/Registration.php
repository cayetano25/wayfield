<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Registration extends Model
{
    use HasFactory;

    protected $fillable = [
        'workshop_id',
        'user_id',
        'registration_status',
        'joined_via_code',
        'registered_at',
        'canceled_at',
    ];

    protected $casts = [
        'registered_at' => 'datetime',
        'canceled_at'   => 'datetime',
    ];

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function selections(): HasMany
    {
        return $this->hasMany(SessionSelection::class);
    }

    public function isActive(): bool
    {
        return $this->registration_status === 'registered';
    }
}
