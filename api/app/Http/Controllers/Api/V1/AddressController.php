<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Address\AddressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AddressController extends Controller
{
    public function __construct(private readonly AddressService $addressService) {}

    /**
     * GET /api/v1/address/countries
     * Return all supported country configs, sorted alphabetically by name.
     */
    public function countries(): JsonResponse
    {
        $data = Cache::remember('address.countries', 3600, function () {
            $countries = config('address_countries');

            $result = [];
            foreach ($countries as $code => $config) {
                $result[] = array_merge(['code' => $code], $config);
            }

            usort($result, fn ($a, $b) => strcmp($a['name'], $b['name']));

            return $result;
        });

        return response()->json($data);
    }

    /**
     * GET /api/v1/address/countries/{code}
     * Return config for a single country by ISO code.
     */
    public function country(string $code): JsonResponse
    {
        $code = strtoupper($code);
        $config = config("address_countries.{$code}");

        if ($config === null) {
            return response()->json(['message' => 'Country not found'], 404);
        }

        return response()->json(array_merge(['code' => $code], $config));
    }

    /**
     * GET /api/v1/address/infer-country?timezone=...
     * Infer the most likely country from a PHP timezone identifier.
     * Always returns 200; unknown timezones fall back to US.
     */
    public function inferCountry(Request $request): JsonResponse
    {
        $timezone = $request->query('timezone', '');
        $countryCode = $this->addressService->inferCountryFromTimezone($timezone);
        $countryName = config("address_countries.{$countryCode}.name") ?? $countryCode;
        $config = $this->addressService->getCountryConfig($countryCode);

        return response()->json([
            'country_code' => $countryCode,
            'country_name' => $countryName,
            'config' => $config,
        ]);
    }
}
