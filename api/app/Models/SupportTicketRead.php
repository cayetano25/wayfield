<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupportTicketRead extends Model
{
    public $timestamps = false;

    protected $table = 'support_ticket_reads';

    protected $fillable = ['ticket_id', 'user_id', 'read_at'];

    protected $casts = [
        'read_at' => 'datetime',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportTicket::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
