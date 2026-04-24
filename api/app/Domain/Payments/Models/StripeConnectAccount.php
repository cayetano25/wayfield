<?php

namespace App\Domain\Payments\Models;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StripeConnectAccount extends Model
{
    protected $fillable = [
        'organization_id',
        'stripe_account_id',
        'onboarding_status',
        'charges_enabled',
        'payouts_enabled',
        'details_submitted',
        'country',
        'default_currency',
        'capabilities_json',
        'requirements_json',
    ];

    protected $casts = [
        'charges_enabled' => 'boolean',
        'payouts_enabled' => 'boolean',
        'details_submitted' => 'boolean',
        'capabilities_json' => 'array',
        'requirements_json' => 'array',
        'onboarding_completed_at' => 'datetime',
        'deauthorized_at' => 'datetime',
        'last_webhook_received_at' => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function isReady(): bool
    {
        return $this->charges_enabled
            && $this->payouts_enabled
            && $this->onboarding_status === 'complete';
    }
}
