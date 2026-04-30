<?php

namespace App\Models;

use App\Domain\Payments\Models\RefundPolicy;
use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Seo\Models\WorkshopCategory;
use App\Domain\Seo\Services\SlugGeneratorService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

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
        'seo_title',
        'seo_description',
        'seo_image_url',
        'social_share_title',
        'social_share_description',
        'social_share_image_file_id',
        'public_page_is_indexable',
        'canonical_url_override',
        'public_summary',
        'join_code_rotated_at',
        'join_code_rotated_by_user_id',
        'header_image_url',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
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

    public function workshopLeaders(): HasMany
    {
        return $this->hasMany(WorkshopLeader::class);
    }

    public function leaders(): BelongsToMany
    {
        return $this->belongsToMany(Leader::class, 'workshop_leaders')
            ->withPivot(['is_confirmed', 'invitation_id'])
            ->withTimestamps();
    }

    public function confirmedLeaders(): BelongsToMany
    {
        return $this->belongsToMany(Leader::class, 'workshop_leaders')
            ->wherePivot('is_confirmed', true)
            ->withPivot(['is_confirmed', 'invitation_id'])
            ->withTimestamps();
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

    public function taxonomies(): HasMany
    {
        return $this->hasMany(WorkshopTaxonomy::class);
    }

    public function primaryTaxonomy(): HasOne
    {
        return $this->hasOne(WorkshopTaxonomy::class)->where('is_primary', true);
    }

    public function tags(): BelongsToMany
    {
        // Explicit FK names — 'tag_id' not Laravel's guessed 'taxonomy_tag_id'
        return $this->belongsToMany(TaxonomyTag::class, 'workshop_tags', 'workshop_id', 'tag_id');
    }

    public function pricing(): HasOne
    {
        return $this->hasOne(WorkshopPricing::class);
    }

    public function refundPolicy(): HasOne
    {
        return $this->hasOne(RefundPolicy::class)->where('scope', 'workshop');
    }

    public function priceTiers(): HasMany
    {
        return $this->hasMany(WorkshopPriceTier::class);
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(WorkshopCategory::class, 'workshop_category_workshop');
    }

    public function favoritedByUsers(): BelongsToMany
    {
        return $this->belongsToMany(
            User::class,
            'workshop_favorites',
            'workshop_id',
            'user_id'
        )->withTimestamps(false);
    }

    // ─── Scopes ──────────────────────────────────────────────────────────────

    public function scopePubliclyVisible(Builder $query): Builder
    {
        return $query->where('status', 'published')
            ->where('public_page_enabled', true)
            ->whereNotNull('public_slug');
    }

    public function scopeForCategory(Builder $query, string $categorySlug): Builder
    {
        return $query->whereHas('categories', fn (Builder $q) => $q->where('slug', $categorySlug));
    }

    public function scopeForLocation(Builder $query, string $stateOrRegion, ?string $city = null): Builder
    {
        return $query->whereHas('defaultLocation', function (Builder $q) use ($stateOrRegion, $city) {
            $q->where('state_or_region', $stateOrRegion);
            if ($city !== null) {
                $q->where('city', $city);
            }
        });
    }

    // ─── Slug helpers ─────────────────────────────────────────────────────────

    /**
     * Generates and sets public_slug if not already set. Slugs are immutable once set.
     * Caller is responsible for persisting the model after calling this method.
     */
    public function ensurePublicSlug(): void
    {
        if (! empty($this->public_slug)) {
            return;
        }

        $this->loadMissing('organization');
        $orgSlug = Str::slug($this->organization?->name ?? 'workshop');

        $this->public_slug = app(SlugGeneratorService::class)
            ->generateWorkshopSlug($this->title, $orgSlug, $this->id ?: null);
    }
}
