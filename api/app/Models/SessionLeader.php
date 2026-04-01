<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SessionLeader extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_id',
        'leader_id',
        'role_label',
        'role_in_session',
        'assignment_status',
        'is_primary',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
    ];

    /**
     * Only accepted assignments confer roster access, messaging rights,
     * and public visibility. Pending/declined/removed assignments are inert.
     */
    public function isAccepted(): bool
    {
        return $this->assignment_status === 'accepted';
    }

    public function isPending(): bool
    {
        return $this->assignment_status === 'pending';
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(Session::class);
    }

    public function leader(): BelongsTo
    {
        return $this->belongsTo(Leader::class);
    }
}
