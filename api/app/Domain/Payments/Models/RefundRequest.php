<?php

namespace App\Domain\Payments\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RefundRequest extends Model
{
    protected $fillable = [
        'order_id',
        'order_item_id',
        'requested_by_user_id',
        'reason_code',
        'reason_text',
        'requested_amount_cents',
        'approved_amount_cents',
        'status',
        'auto_eligible',
        'policy_applied_scope',
        'reviewed_by_user_id',
        'reviewed_at',
        'review_notes',
        'stripe_refund_id',
        'processed_at',
    ];

    protected $casts = [
        'requested_amount_cents' => 'integer',
        'approved_amount_cents' => 'integer',
        'auto_eligible' => 'boolean',
        'reviewed_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }

    public function refundTransactions(): HasMany
    {
        return $this->hasMany(RefundTransaction::class);
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }
}
