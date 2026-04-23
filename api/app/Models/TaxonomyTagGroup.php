<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaxonomyTagGroup extends Model
{
    use HasFactory;
    protected $fillable = [
        'key',
        'label',
        'description',
        'allows_multiple',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'allows_multiple' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function tags(): HasMany
    {
        return $this->hasMany(TaxonomyTag::class, 'tag_group_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }
}
