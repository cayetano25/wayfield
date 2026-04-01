<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Workshop extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'workshop_type',
        'title',
        'description',
        'status',
        'timezone',
        'start_date',
        'end_date',
        'join_code',
        'default_location_id',
        'public_page_enabled',
        'public_slug',
    ];

    protected $casts = [
        'start_date'          => 'date',
        'end_date'            => 'date',
        'public_page_enabled' => 'boolean',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function defaultLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'default_location_id');
    }

    public function logistics(): HasOne
    {
        return $this->hasOne(WorkshopLogistics::class);
    }

    public function publicPage(): HasOne
    {
        return $this->hasOne(PublicPage::class);
    }

    public function tracks(): HasMany
    {
        return $this->hasMany(Track::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(Session::class);
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(Registration::class);
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function isArchived(): bool
    {
        return $this->status === 'archived';
    }

    public function isSessionBased(): bool
    {
        return $this->workshop_type === 'session_based';
    }

    public function isEventBased(): bool
    {
        return $this->workshop_type === 'event_based';
    }
}
