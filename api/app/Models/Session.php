<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Session extends Model
{
    use HasFactory;

    protected $fillable = [
        'workshop_id',
        'track_id',
        'title',
        'description',
        'start_at',
        'end_at',
        'location_id',
        'capacity',
        'delivery_type',
        'virtual_participation_allowed',
        'meeting_platform',
        'meeting_url',
        'meeting_instructions',
        'meeting_id',
        'meeting_passcode',
        'notes',
        'is_published',
        'header_image_url',
    ];

    protected $casts = [
        'start_at'                     => 'datetime',
        'end_at'                       => 'datetime',
        'capacity'                     => 'integer',
        'is_published'                 => 'boolean',
        'virtual_participation_allowed' => 'boolean',
    ];

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(Track::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function selections(): HasMany
    {
        return $this->hasMany(SessionSelection::class);
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class);
    }

    public function sessionLeaders(): HasMany
    {
        return $this->hasMany(SessionLeader::class);
    }

    public function leaders(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Leader::class, 'session_leaders')
            ->withPivot(['role_label'])
            ->withTimestamps();
    }

    public function isVirtual(): bool
    {
        return $this->delivery_type === 'virtual';
    }

    public function isHybrid(): bool
    {
        return $this->delivery_type === 'hybrid';
    }

    public function requiresMeetingUrl(): bool
    {
        if ($this->isVirtual()) {
            return true;
        }

        if ($this->isHybrid() && $this->virtual_participation_allowed) {
            return true;
        }

        return false;
    }

    public function hasUnlimitedCapacity(): bool
    {
        return $this->capacity === null;
    }

    /**
     * Count confirmed (selected) participants for capacity enforcement.
     */
    public function confirmedSelectionCount(): int
    {
        return $this->selections()
            ->where('selection_status', 'selected')
            ->count();
    }
}
