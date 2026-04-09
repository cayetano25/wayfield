<?php

namespace App\Console\Commands;

use App\Models\Leader;
use App\Models\Location;
use App\Services\Address\AddressService;
use Illuminate\Console\Command;

class MigrateAddresses extends Command
{
    protected $signature = 'addresses:migrate {--dry-run : Show what would be migrated without making changes}';

    protected $description = 'Migrate existing flat address fields into the canonical addresses table';

    private array $countryMap = [
        'united states' => 'US', 'us' => 'US', 'usa' => 'US',
        'canada' => 'CA', 'ca' => 'CA', 'can' => 'CA',
        'united kingdom' => 'GB', 'uk' => 'GB', 'gb' => 'GB', 'gbr' => 'GB',
        'australia' => 'AU', 'au' => 'AU', 'aus' => 'AU',
        'germany' => 'DE', 'de' => 'DE', 'deu' => 'DE',
        'france' => 'FR', 'fr' => 'FR', 'fra' => 'FR',
        'japan' => 'JP', 'jp' => 'JP', 'jpn' => 'JP',
    ];

    public function handle(AddressService $addressService): int
    {
        $isDryRun = $this->option('dry-run');
        $locationsCount = 0;
        $leadersCount = 0;

        // ── Migrate locations ────────────────────────────────────────────────────
        Location::whereNotNull('address_line_1')
            ->whereNull('address_id')
            ->each(function (Location $location) use ($addressService, $isDryRun, &$locationsCount) {
                $countryCode = $this->resolveCountryCode($location->country);

                $addressData = [
                    'country_code' => $countryCode,
                    'address_line_1' => $location->address_line_1,
                    'address_line_2' => $location->address_line_2,
                    'locality' => $location->city,
                    'administrative_area' => $location->state_or_region,
                    'postal_code' => $location->postal_code,
                    'latitude' => $location->latitude,
                    'longitude' => $location->longitude,
                ];

                if ($isDryRun) {
                    $this->info("Would migrate location #{$location->id}: {$location->address_line_1}");
                } else {
                    $addressData['formatted_address'] = $addressService->buildFormattedAddress(
                        $addressData,
                        $countryCode
                    );

                    $address = $addressService->createFromRequest($addressData);
                    $location->address_id = $address->id;
                    $location->save();
                }

                $locationsCount++;
            });

        // ── Migrate leaders ──────────────────────────────────────────────────────
        Leader::whereNotNull('address_line_1')
            ->whereNull('address_id')
            ->each(function (Leader $leader) use ($addressService, $isDryRun, &$leadersCount) {
                $countryCode = $this->resolveCountryCode($leader->country);

                $addressData = [
                    'country_code' => $countryCode,
                    'address_line_1' => $leader->address_line_1,
                    'address_line_2' => $leader->address_line_2,
                    'locality' => $leader->city,
                    'administrative_area' => $leader->state_or_region,
                    'postal_code' => $leader->postal_code,
                ];

                if ($isDryRun) {
                    $this->info("Would migrate leader #{$leader->id}: {$leader->address_line_1}");
                } else {
                    $address = $addressService->createFromRequest($addressData);
                    $leader->address_id = $address->id;
                    $leader->save();
                }

                $leadersCount++;
            });

        if ($isDryRun) {
            $this->info("Dry run complete: would migrate {$locationsCount} locations, {$leadersCount} leaders.");
        } else {
            $this->info("Migration complete: {$locationsCount} locations migrated, {$leadersCount} leaders migrated.");
        }

        return self::SUCCESS;
    }

    private function resolveCountryCode(?string $country): string
    {
        if ($country === null || $country === '') {
            return 'US';
        }

        $lower = strtolower(trim($country));

        if (isset($this->countryMap[$lower])) {
            return $this->countryMap[$lower];
        }

        // If it already looks like a 2-char ISO code, use it; otherwise fall back to US
        if (strlen($country) === 2 && ctype_alpha($country)) {
            return strtoupper($country);
        }

        return 'US';
    }
}
