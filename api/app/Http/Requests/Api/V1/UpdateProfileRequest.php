<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'first_name'        => ['sometimes', 'required', 'string', 'max:100'],
            'last_name'         => ['sometimes', 'required', 'string', 'max:100'],
            'profile_image_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
        ];
    }
}
