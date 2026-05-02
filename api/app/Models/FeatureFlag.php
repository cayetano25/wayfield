<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeatureFlag extends Model
{
    use HasFactory;

    protected $table = 'organization_feature_flags';

    protected $fillable = [
        'organization_id',
        'feature_key',
        'is_enabled',
        'source',
        'set_by_admin_user_id',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function isManualOverride(): bool
    {
        return $this->source === 'manual_override';
    }
}
