<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfflineSyncSnapshot extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'workshop_id',
        'version_hash',
        'generated_at',
        'created_at',
    ];

    protected $casts = [
        'generated_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }
}
