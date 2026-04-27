<?php

namespace App\Domain\Payments\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Dispute extends Model
{
    protected $fillable = [
        'order_id',
        'stripe_dispute_id',
        'stripe_charge_id',
        'stripe_account_id',
        'amount_cents',
        'currency',
        'reason',
        'status',
        'evidence_due_by',
        'evidence_submitted_at',
        'is_charge_refundable',
        'network_reason_code',
        'evidence_deadline_reminder_sent_at',
        'resolved_at',
        'resolution',
        'stripe_metadata_json',
    ];

    protected $casts = [
        'amount_cents' => 'integer',
        'evidence_due_by' => 'datetime',
        'evidence_submitted_at' => 'datetime',
        'is_charge_refundable' => 'boolean',
        'evidence_deadline_reminder_sent_at' => 'datetime',
        'resolved_at' => 'datetime',
        'stripe_metadata_json' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function isActionRequired(): bool
    {
        return in_array($this->status, ['needs_response', 'warning_needs_response'], true);
    }
}
