<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrganizationLeader extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'leader_id',
        'status',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function leader(): BelongsTo
    {
        return $this->belongsTo(Leader::class);
    }
}
