<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CrispConversation extends Model
{
    protected $fillable = [
        'crisp_session_id',
        'organization_id',
        'user_id',
        'status',
        'subject',
        'first_message_at',
        'last_message_at',
        'first_reply_at',
        'resolved_at',
        'assigned_to',
        'tags_json',
        'message_count',
    ];

    protected $casts = [
        'first_message_at' => 'datetime',
        'last_message_at'  => 'datetime',
        'first_reply_at'   => 'datetime',
        'resolved_at'      => 'datetime',
        'tags_json'        => 'array',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isResolved(): bool
    {
        return $this->status === 'resolved';
    }
}
