<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Domain\Payments\Models\Cart;
use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\PlatformCredit;
use App\Domain\Payments\Models\RefundRequest;
use App\Domain\Payments\Models\WaitlistPromotionPayment;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'first_name',
        'last_name',
        'pronouns',
        'email',
        'phone_number',
        'password_hash',
        'email_verified_at',
        'is_active',
        'last_login_at',
        'profile_image_url',
        'onboarding_intent',
        'onboarding_completed_at',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
            'onboarding_completed_at' => 'datetime',
        ];
    }

    /**
     * Laravel auth uses this to retrieve the password for validation.
     * Our column is password_hash, not password.
     */
    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    public function getAuthPasswordName(): string
    {
        return 'password_hash';
    }

    public function authMethods(): HasMany
    {
        return $this->hasMany(AuthMethod::class);
    }

    public function twoFactorMethods(): HasMany
    {
        return $this->hasMany(UserTwoFactorMethod::class);
    }

    public function twoFactorRecoveryCodes(): HasMany
    {
        return $this->hasMany(UserTwoFactorRecoveryCode::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(UserSession::class);
    }

    public function organizationUsers(): HasMany
    {
        return $this->hasMany(OrganizationUser::class);
    }

    public function leader(): HasOne
    {
        return $this->hasOne(Leader::class);
    }

    public function notificationPreference(): HasOne
    {
        return $this->hasOne(NotificationPreference::class);
    }

    public function pushTokens(): HasMany
    {
        return $this->hasMany(PushToken::class);
    }

    public function notificationRecipients(): HasMany
    {
        return $this->hasMany(NotificationRecipient::class);
    }

    public function organizations(): BelongsToMany
    {
        return $this->belongsToMany(Organization::class, 'organization_users')
            ->withPivot(['role', 'is_active'])
            ->withTimestamps();
    }

    public function profile(): HasOne
    {
        return $this->hasOne(UserProfile::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function carts(): HasMany
    {
        return $this->hasMany(Cart::class);
    }

    public function platformCredits(): HasMany
    {
        return $this->hasMany(PlatformCredit::class);
    }

    public function refundRequests(): HasMany
    {
        return $this->hasMany(RefundRequest::class, 'requested_by_user_id');
    }

    public function waitlistPromotionPayments(): HasMany
    {
        return $this->hasMany(WaitlistPromotionPayment::class);
    }

    public function favoriteWorkshops(): BelongsToMany
    {
        return $this->belongsToMany(
            Workshop::class,
            'workshop_favorites',
            'user_id',
            'workshop_id'
        )->withTimestamps(false);
    }

    public function hasVerifiedEmail(): bool
    {
        return $this->email_verified_at !== null;
    }

    /**
     * Returns true when the user has completed the onboarding intent step.
     * Per AR-3: only users with onboarding_completed_at set are considered done.
     */
    public function hasCompletedOnboarding(): bool
    {
        return $this->onboarding_completed_at !== null;
    }
}
