<?php

namespace App\Models;

use Database\Factories\OrganizationUserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrganizationUser extends Model
{
    /** @use HasFactory<OrganizationUserFactory> */
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'user_id',
        'role',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isOrganizer(): bool
    {
        return in_array($this->role, ['owner', 'admin']);
    }
}
