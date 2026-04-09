<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StripeInvoice extends Model
{
    protected $fillable = [
        'organization_id',
        'stripe_invoice_id',
        'stripe_customer_id',
        'stripe_subscription_id',
        'amount_due',
        'amount_paid',
        'currency',
        'status',
        'invoice_pdf_url',
        'period_start',
        'period_end',
        'paid_at',
        'due_date',
        'attempt_count',
        'next_payment_attempt',
    ];

    protected $casts = [
        'period_start' => 'datetime',
        'period_end' => 'datetime',
        'paid_at' => 'datetime',
        'due_date' => 'datetime',
        'next_payment_attempt' => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /** Amount due in dollars (amounts stored in cents). */
    public function amountDueInDollars(): float
    {
        return $this->amount_due / 100;
    }

    /** Amount paid in dollars. */
    public function amountPaidInDollars(): float
    {
        return $this->amount_paid / 100;
    }
}
