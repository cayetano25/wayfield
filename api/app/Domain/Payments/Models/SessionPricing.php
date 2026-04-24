<?php

namespace App\Domain\Payments\Models;

use App\Models\Session;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SessionPricing extends Model
{
    protected $table = 'session_pricing';

    protected $fillable = [
        'session_id',
        'price_cents',
        'currency',
        'is_nonrefundable',
        'max_purchases',
    ];

    protected $casts = [
        'price_cents' => 'integer',
        'is_nonrefundable' => 'boolean',
        'max_purchases' => 'integer',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(Session::class);
    }
}
