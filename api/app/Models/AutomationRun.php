<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationRun extends Model
{
    protected $fillable = [
        'rule_id',
        'triggered_by',
        'status',
        'started_at',
        'finished_at',
        'input_json',
        'output_json',
        'error_message',
    ];

    protected $casts = [
        'started_at'  => 'datetime',
        'finished_at' => 'datetime',
        'input_json'  => 'array',
        'output_json' => 'array',
    ];

    public function rule(): BelongsTo
    {
        return $this->belongsTo(AutomationRule::class);
    }
}
