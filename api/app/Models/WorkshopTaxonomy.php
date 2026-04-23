<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkshopTaxonomy extends Model
{
    protected $table = 'workshop_taxonomy';

    protected $fillable = [
        'workshop_id',
        'category_id',
        'subcategory_id',
        'specialization_id',
        'is_primary',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
    ];

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(TaxonomyCategory::class, 'category_id');
    }

    public function subcategory(): BelongsTo
    {
        return $this->belongsTo(TaxonomySubcategory::class, 'subcategory_id');
    }

    public function specialization(): BelongsTo
    {
        return $this->belongsTo(TaxonomySpecialization::class, 'specialization_id');
    }
}
