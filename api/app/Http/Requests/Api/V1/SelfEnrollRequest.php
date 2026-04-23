<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Workshop;
use Illuminate\Foundation\Http\FormRequest;

class SelfEnrollRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'bio'             => ['nullable', 'string', 'max:2000'],
            'website_url'     => ['nullable', 'url', 'max:500'],
            'phone_number'    => ['nullable', 'string', 'max:50'],
            'city'            => ['nullable', 'string', 'max:100'],
            'state_or_region' => ['nullable', 'string', 'max:100'],
            'postal_code'     => ['nullable', 'string', 'max:30'],
            'country'         => ['nullable', 'string', 'max:100'],
            'display_name'    => ['nullable', 'string', 'max:255'],
            'workshop_id'     => ['nullable', 'integer', 'exists:workshops,id'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $workshopId = $this->input('workshop_id');

            if ($workshopId === null) {
                return;
            }

            $organization = $this->route('organization');

            $belongsToOrg = Workshop::where('id', $workshopId)
                ->where('organization_id', $organization->id)
                ->exists();

            if (! $belongsToOrg) {
                $validator->errors()->add(
                    'workshop_id',
                    'The selected workshop does not belong to this organization.'
                );
            }
        });
    }
}
