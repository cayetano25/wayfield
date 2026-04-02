<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Wraps the resolved entitlements array returned by
 * ResolveOrganizationEntitlementsService::resolve().
 */
class EntitlementsResource extends JsonResource
{
    /**
     * @param array{plan: string, subscription_status: string, limits: array, features: array, usage: array} $resource
     */
    public function toArray(Request $request): array
    {
        return [
            'plan'                => $this->resource['plan'],
            'subscription_status' => $this->resource['subscription_status'],
            'limits'              => $this->resource['limits'],
            'features'            => $this->resource['features'],
            'usage'               => $this->resource['usage'],
        ];
    }
}
