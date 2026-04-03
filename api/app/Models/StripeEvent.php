<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StripeEvent extends Model
{
    // Append-only webhook log — no updated_at
    public const UPDATED_AT = null;

    protected $fillable = [
        'stripe_event_id',
        'event_type',
        'livemode',
        'payload_json',
        'processed_at',
        'error_message',
    ];

    protected $casts = [
        'livemode'     => 'boolean',
        'payload_json' => 'array',
        'processed_at' => 'datetime',
    ];

    public function isProcessed(): bool
    {
        return $this->processed_at !== null;
    }

    public function hasError(): bool
    {
        return $this->error_message !== null;
    }
}
