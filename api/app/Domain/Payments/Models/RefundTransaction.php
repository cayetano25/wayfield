<?php

namespace App\Domain\Payments\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RefundTransaction extends Model
{
    protected $fillable = [
        'refund_request_id',
        'order_id',
        'stripe_refund_id',
        'stripe_charge_id',
        'stripe_account_id',
        'amount_cents',
        'currency',
        'status',
        'failure_reason',
        'stripe_created_at',
    ];

    protected $casts = [
        'amount_cents' => 'integer',
        'stripe_created_at' => 'datetime',
    ];

    public function refundRequest(): BelongsTo
    {
        return $this->belongsTo(RefundRequest::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
