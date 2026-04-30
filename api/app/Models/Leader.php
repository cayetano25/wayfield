<?php

namespace App\Models;

use App\Domain\Seo\Services\SlugGeneratorService;
use Database\Factories\LeaderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Leader extends Model
{
    /** @use HasFactory<LeaderFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'first_name',
        'last_name',
        'display_name',
        'slug',
        'bio',
        'profile_image_url',
        'website_url',
        'social_instagram',
        'social_twitter',
        'email',
        'phone_number',
        'address_line_1',
        'address_line_2',
        'city',
        'state_or_region',
        'postal_code',
        'country',
        'address_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function address(): BelongsTo
    {
        return $this->belongsTo(Address::class);
    }

    public function organizationLeaders(): HasMany
    {
        return $this->hasMany(OrganizationLeader::class);
    }

    public function organizations(): BelongsToMany
    {
        return $this->belongsToMany(Organization::class, 'organization_leaders')
            ->withPivot(['status'])
            ->withTimestamps();
    }

    public function workshopLeaders(): HasMany
    {
        return $this->hasMany(WorkshopLeader::class);
    }

    public function workshops(): BelongsToMany
    {
        return $this->belongsToMany(Workshop::class, 'workshop_leaders')
            ->withPivot(['is_confirmed', 'invitation_id'])
            ->withTimestamps();
    }

    public function sessionLeaders(): HasMany
    {
        return $this->hasMany(SessionLeader::class);
    }

    public function sessions(): BelongsToMany
    {
        return $this->belongsToMany(Session::class, 'session_leaders')
            ->withPivot(['role_label', 'assignment_status'])
            ->withTimestamps();
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(LeaderInvitation::class);
    }

    public function isLinkedToUser(): bool
    {
        return $this->user_id !== null;
    }

    /**
     * Generates and sets slug from first_name + last_name if not already set.
     * Slugs are immutable once set. Caller is responsible for saving.
     */
    public function ensureSlug(): void
    {
        if (! empty($this->slug)) {
            return;
        }

        $source = trim("{$this->first_name} {$this->last_name}");

        $this->slug = app(SlugGeneratorService::class)
            ->generate($source, 'leaders', 'slug', $this->id ?: null);
    }
}
