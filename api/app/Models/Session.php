<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Session extends Model
{
    use HasFactory;

    /** Valid location type values */
    public const LOCATION_TYPE_HOTEL = 'hotel';

    public const LOCATION_TYPE_ADDRESS = 'address';

    public const LOCATION_TYPE_COORDINATES = 'coordinates';

    public const LOCATION_TYPES = [
        self::LOCATION_TYPE_HOTEL,
        self::LOCATION_TYPE_ADDRESS,
        self::LOCATION_TYPE_COORDINATES,
    ];

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
        'location_type',
        'location_notes',
    ];

    protected $casts = [
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'capacity' => 'integer',
        'is_published' => 'boolean',
        'virtual_participation_allowed' => 'boolean',
        'location_type' => 'string',
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

    public function leaders(): BelongsToMany
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

    /**
     * Returns true if this session uses the workshop hotel as its location.
     * When true, location_id is null and location is resolved from workshop_logistics.
     */
    public function usesHotelLocation(): bool
    {
        return $this->location_type === self::LOCATION_TYPE_HOTEL;
    }

    /**
     * Returns true if this session has a field coordinate location.
     */
    public function usesCoordinates(): bool
    {
        return $this->location_type === self::LOCATION_TYPE_COORDINATES;
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
