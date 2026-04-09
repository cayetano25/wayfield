<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkshopLogistics extends Model
{
    use HasFactory;

    protected $table = 'workshop_logistics';

    protected $fillable = [
        'workshop_id',
        'hotel_name',
        'hotel_address',
        'hotel_phone',
        'hotel_notes',
        'parking_details',
        'meeting_room_details',
        'meetup_instructions',
        'hotel_address_id',
    ];

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function hotelAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'hotel_address_id');
    }
}
