<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfflineActionQueue extends Model
{
    protected $table = 'offline_action_queue';

    protected $fillable = [
        'user_id',
        'workshop_id',
        'action_type',
        'client_action_uuid',
        'payload_json',
        'processed_at',
    ];

    protected $casts = [
        'payload_json' => 'array',
        'processed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function isProcessed(): bool
    {
        return $this->processed_at !== null;
    }
}
