<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CreateOrUpdateLogisticsRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'hotel_name'           => ['nullable', 'string', 'max:255'],
            'hotel_address'        => ['nullable', 'string', 'max:255'],
            'hotel_phone'          => ['nullable', 'string', 'max:50'],
            'hotel_notes'          => ['nullable', 'string'],
            'parking_details'      => ['nullable', 'string'],
            'meeting_room_details' => ['nullable', 'string'],
            'meetup_instructions'  => ['nullable', 'string'],
        ];
    }
}
