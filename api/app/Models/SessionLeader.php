<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SessionLeader extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_id',
        'leader_id',
        'role_label',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(Session::class);
    }

    public function leader(): BelongsTo
    {
        return $this->belongsTo(Leader::class);
    }
}
