<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PublicPage extends Model
{
    use HasFactory;

    protected $fillable = [
        'workshop_id',
        'hero_title',
        'hero_subtitle',
        'body_content',
        'is_visible',
    ];

    protected $casts = [
        'is_visible' => 'boolean',
    ];

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }
}
