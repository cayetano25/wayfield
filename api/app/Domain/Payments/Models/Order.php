<?php

namespace App\Domain\Payments\Models;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'order_number',
        'user_id',
        'organization_id',
        'cart_id',
        'status',
        'payment_method',
        'subtotal_cents',
        'wayfield_fee_cents',
        'stripe_fee_cents',
        'total_cents',
        'organizer_payout_cents',
        'currency',
        'take_rate_pct',
        'stripe_payment_intent_id',
        'stripe_charge_id',
        'is_deposit_order',
        'deposit_paid_at',
        'balance_due_date',
        'balance_paid_at',
        'balance_stripe_payment_intent_id',
        'completed_at',
        'cancelled_at',
        'cancellation_reason',
        'metadata_json',
    ];

    protected $casts = [
        'subtotal_cents' => 'integer',
        'wayfield_fee_cents' => 'integer',
        'stripe_fee_cents' => 'integer',
        'total_cents' => 'integer',
        'organizer_payout_cents' => 'integer',
        'take_rate_pct' => 'float',
        'is_deposit_order' => 'boolean',
        'deposit_paid_at' => 'datetime',
        'balance_due_date' => 'date',
        'balance_paid_at' => 'datetime',
        'completed_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'metadata_json' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function cart(): BelongsTo
    {
        return $this->belongsTo(Cart::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function paymentIntents(): HasMany
    {
        return $this->hasMany(PaymentIntentRecord::class);
    }

    public function refundRequests(): HasMany
    {
        return $this->hasMany(RefundRequest::class);
    }

    public function isFullyPaid(): bool
    {
        if ($this->status !== 'completed') {
            return false;
        }

        return ! $this->is_deposit_order || $this->balance_paid_at !== null;
    }

    public function isDepositOnly(): bool
    {
        return $this->is_deposit_order
            && $this->deposit_paid_at !== null
            && $this->balance_paid_at === null;
    }

    public function getPaymentStatusLabel(): string
    {
        if ($this->payment_method === 'free') {
            return 'Free';
        }

        return match (true) {
            $this->isFullyPaid() => 'Fully Paid',
            $this->isDepositOnly() => 'Deposit Paid',
            $this->status === 'pending' => 'Pending',
            $this->status === 'processing' => 'Processing',
            $this->status === 'failed' => 'Failed',
            $this->status === 'cancelled' => 'Cancelled',
            $this->status === 'partially_refunded' => 'Partially Refunded',
            $this->status === 'fully_refunded' => 'Fully Refunded',
            $this->status === 'disputed' => 'Disputed',
            default => ucfirst($this->status),
        };
    }

    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    public function scopeForOrganization(Builder $query, int $orgId): Builder
    {
        return $query->where('organization_id', $orgId);
    }
}
