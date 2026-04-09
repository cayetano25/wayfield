<?php

namespace App\Http\Resources;

use App\Services\Address\AddressService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrganizationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'primary_contact_first_name' => $this->primary_contact_first_name,
            'primary_contact_last_name' => $this->primary_contact_last_name,
            'primary_contact_email' => $this->primary_contact_email,
            'primary_contact_phone' => $this->primary_contact_phone,
            'status' => $this->status,
            'logo_url' => $this->logo_url,
            'address' => $this->whenLoaded('address', fn () => $this->address ? app(AddressService::class)->toApiResponse($this->address) : null
            ),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
