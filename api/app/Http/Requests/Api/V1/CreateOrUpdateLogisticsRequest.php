<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CreateOrUpdateLogisticsRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'hotel_name' => ['nullable', 'string', 'max:255'],
            'hotel_address' => ['nullable'],  // string (legacy varchar) or array (structured)
            'hotel_phone' => ['nullable', 'string', 'max:50'],
            'hotel_notes' => ['nullable', 'string'],
            'parking_details' => ['nullable', 'string'],
            'meeting_room_details' => ['nullable', 'string'],
            'meetup_instructions' => ['nullable', 'string'],
            // Structured hotel address — only applied when hotel_address is an array
            'hotel_address.country_code' => ['required_if_accepted:hotel_address', 'nullable', 'size:2'],
            'hotel_address.address_line_1' => ['nullable', 'string', 'max:255'],
            'hotel_address.address_line_2' => ['nullable', 'string', 'max:255'],
            'hotel_address.locality' => ['nullable', 'string', 'max:100'],
            'hotel_address.administrative_area' => ['nullable', 'string', 'max:100'],
            'hotel_address.postal_code' => ['nullable', 'string', 'max:30'],
        ];
    }
}
