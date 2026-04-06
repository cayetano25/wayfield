<?php

namespace App\Models;

use Database\Factories\OrganizationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Organization extends Model
{
    /** @use HasFactory<OrganizationFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'primary_contact_first_name',
        'primary_contact_last_name',
        'primary_contact_email',
        'primary_contact_phone',
        'status',
        'logo_url',
    ];

    public function organizationUsers(): HasMany
    {
        return $this->hasMany(OrganizationUser::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'organization_users')
            ->withPivot(['role', 'is_active'])
            ->withTimestamps();
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class)->latestOfMany();
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function activeSubscription(): HasOne
    {
        return $this->hasOne(Subscription::class)
            ->where('status', 'active')
            ->latestOfMany();
    }

    public function workshops(): HasMany
    {
        return $this->hasMany(Workshop::class);
    }

    public function locations(): HasMany
    {
        return $this->hasMany(Location::class);
    }

    public function organizationLeaders(): HasMany
    {
        return $this->hasMany(OrganizationLeader::class);
    }

    public function leaders(): BelongsToMany
    {
        return $this->belongsToMany(Leader::class, 'organization_leaders')
            ->withPivot(['status'])
            ->withTimestamps();
    }

    public function leaderInvitations(): HasMany
    {
        return $this->hasMany(LeaderInvitation::class);
    }

    public function featureFlags(): HasMany
    {
        return $this->hasMany(FeatureFlag::class);
    }
}
