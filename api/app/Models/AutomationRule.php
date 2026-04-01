<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AutomationRule extends Model
{
    protected $fillable = [
        'organization_id',
        'name',
        'trigger_event',
        'conditions_json',
        'actions_json',
        'is_active',
        'last_run_at',
    ];

    protected $casts = [
        'conditions_json' => 'array',
        'actions_json'    => 'array',
        'is_active'       => 'boolean',
        'last_run_at'     => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function runs(): HasMany
    {
        return $this->hasMany(AutomationRun::class, 'rule_id');
    }

    public function isPlatformWide(): bool
    {
        return $this->organization_id === null;
    }
}
