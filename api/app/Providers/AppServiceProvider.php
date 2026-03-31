<?php

namespace App\Providers;

use App\Models\Location;
use App\Models\Organization;
use App\Models\Workshop;
use App\Policies\LocationPolicy;
use App\Policies\OrganizationPolicy;
use App\Policies\OrganizationUserPolicy;
use App\Policies\WorkshopPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider;
use Illuminate\Http\Resources\Json\JsonResource;

class AppServiceProvider extends AuthServiceProvider
{
    protected $policies = [
        Organization::class => OrganizationPolicy::class,
        Workshop::class     => WorkshopPolicy::class,
        Location::class     => LocationPolicy::class,
    ];

    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->registerPolicies();

        // Pure JSON API — no data wrapper on resources.
        JsonResource::withoutWrapping();
    }
}
