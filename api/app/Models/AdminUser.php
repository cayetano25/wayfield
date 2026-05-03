<?php

namespace App\Models;

use Database\Factories\AdminUserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class AdminUser extends Authenticatable
{
    /** @use HasFactory<AdminUserFactory> */
    use HasApiTokens, HasFactory;

    protected $table = 'admin_users';

    /**
     * Override the default password column name.
     * The schema uses password_hash, not password.
     */
    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    public function getAuthPasswordName(): string
    {
        return 'password_hash';
    }

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'password_hash',
        'role',
        'is_active',
        'can_impersonate',
        'last_login_at',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'can_impersonate' => 'boolean',
        'last_login_at' => 'datetime',
    ];

    // ─── Role constants ────────────────────────────────────────────────────────

    public const ROLES = ['super_admin', 'admin', 'support', 'billing', 'readonly'];

    /** Roles that can mutate tenant data via platform actions (feature flags, plan changes). */
    public const MUTATING_ROLES = ['super_admin', 'admin', 'billing'];

    /** Roles that can manage billing and Stripe data. */
    public const ROLES_WITH_BILLING = ['super_admin', 'billing'];

    /** Roles that can manage feature flags. */
    public const ROLES_WITH_FLAGS = ['super_admin', 'admin'];

    // ─── Role helpers ──────────────────────────────────────────────────────────

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    public function hasRole(string ...$roles): bool
    {
        return in_array($this->role, $roles, true);
    }

    /**
     * Returns true if this admin can perform mutations (feature flags, plan changes).
     * Allowed: super_admin, admin, billing
     * Denied:  support, readonly
     */
    public function canMutate(): bool
    {
        return in_array($this->role, self::MUTATING_ROLES, true);
    }

    public function canManageBilling(): bool
    {
        return $this->hasRole(...self::ROLES_WITH_BILLING);
    }

    public function canManageFlags(): bool
    {
        return $this->hasRole(...self::ROLES_WITH_FLAGS);
    }

    public function fullName(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    // ─── Relationships ─────────────────────────────────────────────────────────

    public function platformAuditLogs(): HasMany
    {
        return $this->hasMany(PlatformAuditLog::class, 'admin_user_id');
    }

    public function adminLoginEvents(): HasMany
    {
        return $this->hasMany(AdminLoginEvent::class, 'admin_user_id');
    }
}
