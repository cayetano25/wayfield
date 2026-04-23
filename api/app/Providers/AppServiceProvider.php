<?php

namespace App\Providers;

use App\Models\Address;
use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Location;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\TaxonomyCategory;
use App\Models\TaxonomySpecialization;
use App\Models\TaxonomySubcategory;
use App\Models\TaxonomyTag;
use App\Models\TaxonomyTagGroup;
use App\Models\Track;
use App\Models\Workshop;
use App\Observers\AddressObserver;
use App\Observers\TaxonomyObserver;
use App\Policies\AttendancePolicy;
use App\Policies\LeaderInvitationPolicy;
use App\Policies\LeaderPolicy;
use App\Policies\LocationPolicy;
use App\Policies\BillingPolicy;
use App\Policies\NotificationPolicy;
use App\Policies\OrganizationPolicy;
use App\Policies\RegistrationPolicy;
use App\Policies\RosterPolicy;
use App\Policies\SessionPolicy;
use App\Policies\TrackPolicy;
use App\Policies\WorkshopPolicy;
use App\Services\Auth\RoleContextService;
use App\Services\Sessions\SessionLocationService;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

class AppServiceProvider extends AuthServiceProvider
{
    protected $policies = [
        Organization::class => OrganizationPolicy::class,
        Workshop::class => WorkshopPolicy::class,
        Location::class => LocationPolicy::class,
        Session::class => SessionPolicy::class,
        Track::class => TrackPolicy::class,
        Registration::class => RegistrationPolicy::class,
        Leader::class => LeaderPolicy::class,
        LeaderInvitation::class => LeaderInvitationPolicy::class,
    ];

    public function register(): void
    {
        $this->app->singleton(RoleContextService::class);
        $this->app->singleton(SessionLocationService::class);
    }

    public function boot(): void
    {
        $this->registerPolicies();

        \Stripe\Stripe::setApiKey(config('services.stripe.secret'));

        // Geocoding: dispatch GeocodeAddressJob on address create/update
        Address::observe(AddressObserver::class);

        // Taxonomy: bust cached full-tree response when any taxonomy row changes
        TaxonomyCategory::observe(TaxonomyObserver::class);
        TaxonomySubcategory::observe(TaxonomyObserver::class);
        TaxonomySpecialization::observe(TaxonomyObserver::class);
        TaxonomyTagGroup::observe(TaxonomyObserver::class);
        TaxonomyTag::observe(TaxonomyObserver::class);

        // Phase 5: Attendance, Roster, and Notification gate defines.
        // These are defined as named gates (not tied to a single model-policy mapping)
        // because multiple policies share the Session model context.
        Gate::define('attendance.self-check-in', [AttendancePolicy::class, 'selfCheckIn']);
        Gate::define('attendance.leader-manage', [AttendancePolicy::class, 'leaderManage']);
        Gate::define('attendance.revert', [AttendancePolicy::class, 'revert']);
        Gate::define('roster.view', [RosterPolicy::class, 'view']);
        Gate::define('roster.view-phones', [RosterPolicy::class, 'viewPhoneNumbers']);
        Gate::define('notification.create-leader', [NotificationPolicy::class, 'createLeader']);

        // Phase 7: Offline sync
        Gate::define('sync.download', [WorkshopPolicy::class, 'syncDownload']);

        // Billing gates — owner and billing_admin access
        Gate::define('billing.view',   [BillingPolicy::class, 'view']);
        Gate::define('billing.manage', [BillingPolicy::class, 'manage']);
        Gate::define('billing.cancel', [BillingPolicy::class, 'cancel']);
        Gate::define('billing.portal', [BillingPolicy::class, 'portal']);

        // Pure JSON API — no data wrapper on resources.
        JsonResource::withoutWrapping();
    }
}
