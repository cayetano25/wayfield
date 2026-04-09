<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AutomationRule extends Model
{
    protected $fillable = [
        'name',
        'description',
        'trigger_type',
        'conditions_json',
        'action_type',
        'action_config_json',
        'is_active',
        'scope',
        'organization_id',
        'run_interval_minutes',
        'last_evaluated_at',
        'created_by_admin_id',
    ];

    protected $casts = [
        'conditions_json' => 'array',
        'action_config_json' => 'array',
        'is_active' => 'boolean',
        'last_evaluated_at' => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function createdByAdmin(): BelongsTo
    {
        return $this->belongsTo(AdminUser::class, 'created_by_admin_id');
    }

    public function runs(): HasMany
    {
        return $this->hasMany(AutomationRun::class, 'automation_rule_id');
    }

    public function isPlatformWide(): bool
    {
        return $this->organization_id === null;
    }
}
