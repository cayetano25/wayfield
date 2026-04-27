<?php

namespace App\Domain\Payments\Models;

use App\Models\User;
use App\Models\Workshop;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WaitlistPromotionPayment extends Model
{
    protected $fillable = [
        'user_id',
        'workshop_id',
        'waitlist_entry_id',
        'promotion_order',
        'status',
        'payment_window_hours',
        'window_opened_at',
        'window_expires_at',
        'reminder_sent_at',
        'payment_completed_at',
        'order_id',
        'skipped_at',
    ];

    protected $casts = [
        'payment_window_hours' => 'integer',
        'window_opened_at' => 'datetime',
        'window_expires_at' => 'datetime',
        'reminder_sent_at' => 'datetime',
        'payment_completed_at' => 'datetime',
        'skipped_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function isWindowOpen(): bool
    {
        return $this->status === 'window_open' && $this->window_expires_at->isFuture();
    }
}
