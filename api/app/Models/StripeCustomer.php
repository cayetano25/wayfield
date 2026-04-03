<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StripeCustomer extends Model
{
    protected $fillable = [
        'organization_id',
        'stripe_id',
        'email',
        'name',
        'metadata_json',
    ];

    protected $casts = [
        'metadata_json' => 'array',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(StripeSubscription::class, 'stripe_customer_id', 'stripe_id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(StripeInvoice::class, 'stripe_customer_id', 'stripe_id');
    }
}
