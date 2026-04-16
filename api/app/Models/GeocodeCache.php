<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GeocodeCache extends Model
{
    protected $table = 'geocode_cache';

    protected $fillable = [
        'geocode_hash',
        'normalized_input',
        'provider',
        'latitude',
        'longitude',
        'formatted_address',
        'status',
        'confidence',
        'provider_place_id',
        'provider_type',
        'failure_reason',
        'expires_at',
        'last_resolved_at',
    ];

    protected $casts = [
        'latitude'         => 'float',
        'longitude'        => 'float',
        'confidence'       => 'integer',
        'expires_at'       => 'datetime',
        'last_resolved_at' => 'datetime',
        'created_at'       => 'datetime',
        'updated_at'       => 'datetime',
    ];

    /**
     * Returns true if this cache entry has not expired.
     */
    public function isValid(): bool
    {
        return $this->expires_at === null
            || $this->expires_at->isFuture();
    }

    /**
     * Returns true if this entry has usable coordinates.
     */
    public function hasCoordinates(): bool
    {
        return $this->status === 'hit'
            && $this->latitude !== null
            && $this->longitude !== null;
    }
}
