<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Jobs\GeocodeAddressJob;
use App\Models\Address;
use Illuminate\Console\Command;

/**
 * Finds addresses that need geocoding and dispatches GeocodeAddressJob for each.
 *
 * Use this to:
 *   a) Re-queue addresses created before geocoding was implemented
 *   b) Re-queue addresses that previously failed but may now succeed
 *      (e.g. after an address correction)
 *
 * Usage:
 *   php artisan geocode:pending
 *   php artisan geocode:pending --limit=100
 *   php artisan geocode:pending --dry-run
 */
class GeocodeAddressesPending extends Command
{
    protected $signature = 'geocode:pending
                            {--limit=50 : Maximum number of addresses to dispatch}
                            {--dry-run  : List matching addresses without dispatching jobs}';

    protected $description = 'Dispatch geocoding jobs for addresses that are missing coordinates';

    public function handle(): int
    {
        $maxAttempts = config('services.geocoding.max_attempts', 3);
        $limit = (int) $this->option('limit');
        $dryRun = (bool) $this->option('dry-run');

        $addresses = Address::query()
            ->whereNull('latitude')
            ->where('geocode_attempts', '<', $maxAttempts)
            ->whereNotNull('address_line_1')
            ->limit($limit)
            ->get();

        $this->info("Found {$addresses->count()} addresses needing geocoding.");

        if ($dryRun) {
            foreach ($addresses as $addr) {
                $this->line("  Would geocode address #{$addr->id}: {$addr->formatted_address}");
            }
            $this->info('[dry-run] No jobs dispatched.');

            return self::SUCCESS;
        }

        $dispatched = 0;
        foreach ($addresses as $address) {
            GeocodeAddressJob::dispatchForAddress($address);
            $dispatched++;
        }

        $this->info("Dispatched {$dispatched} GeocodeAddressJob(s) to the geocoding queue.");

        return self::SUCCESS;
    }
}
