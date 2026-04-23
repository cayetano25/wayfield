<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Session;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class CreateSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Authorization handled in controller via policy
    }

    public function rules(): array
    {
        return [
            'track_id' => ['nullable', 'integer', 'exists:tracks,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date', 'after:start_at'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'delivery_type' => ['required', 'string', 'in:in_person,virtual,hybrid'],
            'virtual_participation_allowed' => ['boolean'],
            'meeting_platform' => ['nullable', 'string', 'max:100'],
            'meeting_url' => ['nullable', 'string', 'url', 'max:1000'],
            'meeting_instructions' => ['nullable', 'string'],
            'meeting_id' => ['nullable', 'string', 'max:255'],
            'meeting_passcode' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'is_published' => ['boolean'],

            // Access-control fields (addon sessions feature)
            'publication_status' => ['nullable', 'string', 'in:draft,published,archived,cancelled'],
            'session_type' => ['nullable', 'string', 'in:standard,addon,private,vip,makeup_session'],
            'participant_visibility' => ['nullable', 'string', 'in:visible,hidden,invite_only'],
            'enrollment_mode' => ['nullable', 'string', 'in:self_select,organizer_assign_only,invite_accept,purchase_required'],
            'requires_separate_entitlement' => ['nullable', 'boolean'],
            'selection_opens_at' => ['nullable', 'date_format:Y-m-d\TH:i:sP'],
            'selection_closes_at' => ['nullable', 'date_format:Y-m-d\TH:i:sP', 'after:selection_opens_at'],

            // Location type fields
            'location_type' => ['nullable', Rule::in(Session::LOCATION_TYPES)],
            'location_notes' => ['nullable', 'string', 'max:500'],

            // Coordinate fields — only required when location_type = coordinates
            'latitude' => ['nullable', 'required_if:location_type,coordinates', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'required_if:location_type,coordinates', 'numeric', 'between:-180,180'],
            'location_name' => ['nullable', 'string', 'max:255'],

            // Address fields — only required when location_type = address
            'address' => ['nullable', 'array', 'required_if:location_type,address'],
            'address.country_code' => ['required_with:address', 'string', 'size:2'],
            'address.address_line_1' => ['required_with:address', 'string', 'max:255'],
            'address.address_line_2' => ['nullable', 'string', 'max:255'],
            'address.locality' => ['nullable', 'string', 'max:100'],
            'address.administrative_area' => ['nullable', 'string', 'max:100'],
            'address.postal_code' => ['nullable', 'string', 'max:30'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $type = $v->getData()['location_type'] ?? null;
            if ($type === 'hotel' && ! empty($v->getData()['location_id'])) {
                $v->errors()->add(
                    'location_id',
                    'A hotel-type session location must not include a location_id.'
                );
            }
        });
    }
}
