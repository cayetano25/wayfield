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
        'assignment_source',
        'assigned_by_user_id',
        'assigned_at',
        'assignment_notes',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
    ];

    public function registration(): BelongsTo
    {
        return $this->belongsTo(Registration::class);
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(Session::class);
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by_user_id');
    }
}
