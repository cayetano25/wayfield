<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SsoConfiguration extends Model
{
    protected $fillable = [
        'organization_id',
        'provider_type',
        'is_enabled',
        'entity_id',
        'sso_url',
        'certificate',
        'client_secret_enc',
        'attribute_mapping',
        'allowed_domains',
    ];

    protected $casts = [
        'is_enabled'        => 'boolean',
        'attribute_mapping' => 'array',
        'allowed_domains'   => 'array',
    ];

    protected $hidden = [
        'certificate',
        'client_secret_enc',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
