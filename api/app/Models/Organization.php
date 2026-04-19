<?php

namespace App\Models;

use Database\Factories\OrganizationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
        'address_id',
    ];

    public function address(): BelongsTo
    {
        return $this->belongsTo(Address::class);
    }

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

    /**
     * Returns the stored role value for the given user in this organisation,
     * or null if the user has no membership row.
     *
     * Role values: 'owner' | 'admin' | 'staff' | 'billing_admin' | null
     *
     * Always queries the database. Never trusts a cached or client-provided value.
     * Per ROLE_MODEL.md Section 6: role must be read from DB on every check.
     */
    public function memberRole(User $user): ?string
    {
        return $this->organizationUsers()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->value('role');
    }

    /**
     * Returns true if the user has owner or admin role in this organisation.
     * Use for: workshop management, leader invitations, member management.
     * Allowed: owner, admin
     * Denied: staff, billing_admin, null
     */
    public function isElevatedMember(User $user): bool
    {
        return in_array($this->memberRole($user), ['owner', 'admin'], true);
    }

    /**
     * Returns true if the user has any operational access to this organisation.
     * Use for: workshop viewing, attendance management, notifications.
     * Allowed: owner, admin, staff
     * Denied: billing_admin, null
     */
    public function isOperationalMember(User $user): bool
    {
        return in_array($this->memberRole($user), ['owner', 'admin', 'staff'], true);
    }

    /**
     * Returns true if the user has billing access for this organisation.
     * Use for: subscription management, invoice viewing, plan changes.
     * Allowed: owner, billing_admin
     * Denied: admin, staff, null
     */
    public function hasBillingAccess(User $user): bool
    {
        return in_array($this->memberRole($user), ['owner', 'billing_admin'], true);
    }

    /**
     * Returns true if the user is the sole active owner of this organisation.
     * Use for: blocking owner removal, blocking org deletion without transfer.
     */
    public function isSoleOwner(User $user): bool
    {
        if ($this->memberRole($user) !== 'owner') {
            return false;
        }

        return $this->organizationUsers()
            ->where('role', 'owner')
            ->where('is_active', true)
            ->count() === 1;
    }
}
