<?php

namespace App\Domain\Payments\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Named PaymentIntentRecord to avoid collision with Stripe's PaymentIntent SDK class.
 * DB table: payment_intents
 */
class PaymentIntentRecord extends Model
{
    protected $table = 'payment_intents';

    protected $fillable = [
        'order_id',
        'intent_type',
        'stripe_payment_intent_id',
        'stripe_account_id',
        'amount_cents',
        'currency',
        'application_fee_cents',
        'status',
        'stripe_status',
        'last_payment_error',
        'confirmed_at',
        'cancelled_at',
        'metadata_json',
    ];

    // client_secret_hash intentionally excluded from fillable — set explicitly only.

    protected $casts = [
        'amount_cents' => 'integer',
        'application_fee_cents' => 'integer',
        'confirmed_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'metadata_json' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function isSucceeded(): bool
    {
        return $this->status === 'succeeded';
    }
}
