<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SessionSelection extends Model
{
    use HasFactory;

    protected $fillable = [
        'registration_id',
        'session_id',
        'selection_status',
    ];

    public function registration(): BelongsTo
    {
        return $this->belongsTo(Registration::class);
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(Session::class);
    }
}
