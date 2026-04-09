<?php

namespace App\Http\Requests\Api\V1\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Handles Step 3 (intent selection) and Step 4 (first contextual action).
 */
class CompleteOnboardingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'intent' => ['required', Rule::in([
                'join_workshop',
                'create_organization',
                'accept_invitation',
                'exploring',
            ])],

            // Required only when intent = join_workshop
            'join_code' => [
                'required_if:intent,join_workshop',
                'nullable',
                'string',
                'max:100',
            ],

            // Required only when intent = accept_invitation
            'invitation_token' => [
                'required_if:intent,accept_invitation',
                'nullable',
                'string',
            ],

            // Required only when intent = create_organization
            'organization_name' => [
                'required_if:intent,create_organization',
                'nullable',
                'string',
                'max:255',
            ],
            'organization_slug' => [
                'required_if:intent,create_organization',
                'nullable',
                'string',
                'max:255',
                'alpha_dash',
                'unique:organizations,slug',
            ],
        ];
    }
}
