<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SystemAnnouncement extends Model
{
    protected $fillable = [
        'title',
        'message',
        'announcement_type',
        'severity',
        'target_audience',
        'is_active',
        'is_dismissable',
        'starts_at',
        'ends_at',
        'created_by_admin_id',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'is_active' => 'boolean',
        'is_dismissable' => 'boolean',
    ];

    /** @var array<string, string> */
    public const TYPE_COLORS = [
        'info' => '#7EA8BE',
        'warning' => '#F59E0B',
        'maintenance' => '#E67E22',
        'outage' => '#E94F37',
        'update' => '#0FA3B1',
    ];

    public function createdByAdmin(): BelongsTo
    {
        return $this->belongsTo(AdminUser::class, 'created_by_admin_id');
    }

    /**
     * Scope to announcements that are currently visible:
     *   - is_active = true
     *   - starts_at <= now
     *   - ends_at IS NULL or ends_at > now
     * Ordered by severity (critical first) then starts_at ascending.
     */
    public function scopeCurrentlyActive(Builder $query): Builder
    {
        return $query
            ->where('is_active', true)
            ->where('starts_at', '<=', now())
            ->where(function (Builder $q) {
                $q->whereNull('ends_at')
                    ->orWhere('ends_at', '>', now());
            })
            ->orderByRaw("CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END")
            ->orderBy('starts_at', 'asc');
    }
}
