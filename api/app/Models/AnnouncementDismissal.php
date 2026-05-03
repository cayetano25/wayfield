<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnnouncementDismissal extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'announcement_id',
        'user_id',
        'dismissed_at',
    ];

    protected $casts = [
        'dismissed_at' => 'datetime',
    ];

    public function announcement(): BelongsTo
    {
        return $this->belongsTo(SystemAnnouncement::class, 'announcement_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
