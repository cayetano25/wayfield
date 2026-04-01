<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkshopLeader extends Model
{
    use HasFactory;

    protected $fillable = [
        'workshop_id',
        'leader_id',
        'invitation_id',
        'is_confirmed',
    ];

    protected $casts = [
        'is_confirmed' => 'boolean',
    ];

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function leader(): BelongsTo
    {
        return $this->belongsTo(Leader::class);
    }

    public function invitation(): BelongsTo
    {
        return $this->belongsTo(LeaderInvitation::class, 'invitation_id');
    }
}
