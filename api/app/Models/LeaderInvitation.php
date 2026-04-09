<?php

namespace App\Models;

use Database\Factories\LeaderInvitationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaderInvitation extends Model
{
    /** @use HasFactory<LeaderInvitationFactory> */
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'workshop_id',
        'leader_id',
        'invited_email',
        'invited_first_name',
        'invited_last_name',
        'status',
        'invitation_token_hash',
        'expires_at',
        'responded_at',
        'created_by_user_id',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'responded_at' => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function leader(): BelongsTo
    {
        return $this->belongsTo(Leader::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isExpired(): bool
    {
        return $this->status === 'expired' || $this->expires_at->isPast();
    }

    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }

    public function isActionable(): bool
    {
        return $this->isPending() && ! $this->expires_at->isPast();
    }
}
