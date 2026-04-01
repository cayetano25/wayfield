<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    protected $fillable = [
        'organization_id',
        'subscription_id',
        'invoice_number',
        'amount_cents',
        'currency',
        'status',
        'billing_reason',
        'period_start',
        'period_end',
        'paid_at',
        'due_at',
        'invoice_pdf_url',
        'metadata_json',
    ];

    protected $casts = [
        'amount_cents'  => 'integer',
        'period_start'  => 'datetime',
        'period_end'    => 'datetime',
        'paid_at'       => 'datetime',
        'due_at'        => 'datetime',
        'metadata_json' => 'array',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function isPaid(): bool
    {
        return $this->status === 'paid';
    }
}
