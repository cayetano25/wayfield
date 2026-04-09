<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Location extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'name',
        'address_line_1',
        'address_line_2',
        'city',
        'state_or_region',
        'postal_code',
        'country',
        'latitude',
        'longitude',
        'address_id',
        'country_code',
    ];

    protected $casts = [
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function address(): BelongsTo
    {
        return $this->belongsTo(Address::class);
    }

    /**
     * Returns true if this location is defined by coordinates only,
     * with no structured address.
     */
    public function isCoordinateOnly(): bool
    {
        return $this->latitude !== null
            && $this->longitude !== null
            && $this->address_id === null;
    }

    public function workshops(): HasMany
    {
        return $this->hasMany(Workshop::class, 'default_location_id');
    }
}
