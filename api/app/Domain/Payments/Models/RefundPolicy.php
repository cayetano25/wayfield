<?php

namespace App\Domain\Payments\Models;

use App\Models\Organization;
use App\Models\Workshop;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RefundPolicy extends Model
{
    protected $fillable = [
        'scope',
        'organization_id',
        'workshop_id',
        'full_refund_cutoff_days',
        'partial_refund_cutoff_days',
        'partial_refund_pct',
        'no_refund_cutoff_hours',
        'wayfield_fee_refundable',
        'stripe_fee_refundable',
        'allow_credits',
        'credit_expiry_days',
        'custom_policy_text',
    ];

    protected $casts = [
        'partial_refund_pct' => 'float',
        'wayfield_fee_refundable' => 'boolean',
        'stripe_fee_refundable' => 'boolean',
        'allow_credits' => 'boolean',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }
}
