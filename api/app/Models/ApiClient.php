<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApiClient extends Model
{
    protected $fillable = [
        'organization_id',
        'name',
        'client_id',
        'client_secret_hash',
        'scopes_json',
        'is_active',
        'last_used_at',
        'created_by_user_id',
    ];

    protected $hidden = [
        'client_secret_hash',
    ];

    protected $casts = [
        'scopes_json'  => 'array',
        'is_active'    => 'boolean',
        'last_used_at' => 'datetime',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
