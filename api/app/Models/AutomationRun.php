<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationRun extends Model
{
    // Append-only execution log — no updated_at
    public const UPDATED_AT = null;

    protected $fillable = [
        'automation_rule_id',
        'triggered_at',
        'entity_type',
        'entity_id',
        'outcome',
        'actions_taken_count',
        'metadata_json',
        'error_message',
    ];

    protected $casts = [
        'triggered_at'       => 'datetime',
        'metadata_json'      => 'array',
    ];

    public function rule(): BelongsTo
    {
        return $this->belongsTo(AutomationRule::class, 'automation_rule_id');
    }
}
