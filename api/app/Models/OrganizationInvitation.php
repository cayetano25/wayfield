<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\OrganizationInvitationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrganizationInvitation extends Model
{
    /** @use HasFactory<OrganizationInvitationFactory> */
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'invited_email',
        'invited_first_name',
        'invited_last_name',
        'role',
        'status',
        'invitation_token_hash',
        'expires_at',
        'responded_at',
        'created_by_user_id',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'responded_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /** Valid stored role values that can be granted via invitation. */
    public const VALID_ROLES = ['owner', 'admin', 'staff', 'billing_admin'];

    /**
     * Roles that can be granted via invitation (owner is excluded —
     * ownership is transferred, not invited).
     */
    public const INVITABLE_ROLES = ['admin', 'staff', 'billing_admin'];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Pending = status is 'pending' AND not time-expired.
     * Used to gate accept/decline actions.
     */
    public function isPending(): bool
    {
        return $this->status === 'pending' && ! $this->isExpired();
    }
}
