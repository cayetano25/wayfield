<?php

namespace App\Domain\Payments\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformCredit extends Model
{
    protected $fillable = [
        'user_id',
        'amount_cents',
        'currency',
        'source_type',
        'source_refund_request_id',
        'is_used',
        'expires_at',
        'used_at',
        'used_in_order_id',
        'notes',
    ];

    protected $casts = [
        'amount_cents' => 'integer',
        'is_used' => 'boolean',
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sourceRefundRequest(): BelongsTo
    {
        return $this->belongsTo(RefundRequest::class, 'source_refund_request_id');
    }

    public function usedInOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'used_in_order_id');
    }

    public function isValid(): bool
    {
        return ! $this->is_used && $this->expires_at->isFuture();
    }

    public function scopeValidForUser(Builder $query, int $userId): Builder
    {
        return $query
            ->where('user_id', $userId)
            ->where('is_used', false)
            ->where('expires_at', '>', now());
    }
}
