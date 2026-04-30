<?php

namespace App\Domain\Payments\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduledPaymentJob extends Model
{
    protected $fillable = [
        'job_type',
        'notification_code',
        'related_entity_type',
        'related_entity_id',
        'user_id',
        'scheduled_for',
        'status',
        'attempts',
        'max_attempts',
        'last_attempted_at',
        'completed_at',
        'cancelled_at',
        'cancellation_reason',
        'result_message',
        'metadata_json',
    ];

    protected $casts = [
        'scheduled_for' => 'datetime',
        'last_attempted_at' => 'datetime',
        'completed_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'metadata_json' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopePending(Builder $query): Builder
    {
        return $query
            ->where('status', 'pending')
            ->where('scheduled_for', '<=', now());
    }

    public function scopeForEntity(Builder $query, string $type, int $id): Builder
    {
        return $query
            ->where('related_entity_type', $type)
            ->where('related_entity_id', $id);
    }

    public function cancel(string $reason): bool
    {
        return $this->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'cancellation_reason' => $reason,
        ]);
    }
}
