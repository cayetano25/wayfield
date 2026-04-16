<?php

declare(strict_types=1);

namespace App\Services\Geocoding;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Thin HTTP wrapper for the Nominatim geocoding API.
 *
 * Responsibilities:
 *   - Send a single structured or free-text search request.
 *   - Enforce the User-Agent header (required by Nominatim policy).
 *   - Apply timeout configuration.
 *   - Return raw decoded JSON or throw a typed exception.
 *
 * Does NOT:
 *   - Handle caching (that is GeocodingService's job).
 *   - Handle retries (GeocodeAddressJob retries via Laravel queue).
 *   - Dispatch jobs or touch the database.
 */
final class NominatimClient
{
    private string $baseUrl;
    private string $userAgent;
    private int    $timeout;

    public function __construct()
    {
        $this->baseUrl   = rtrim(config('services.nominatim.base_url'), '/');
        $this->userAgent = config('services.nominatim.user_agent');
        $this->timeout   = config('services.nominatim.timeout', 10);
    }

    /**
     * Performs a forward geocoding search.
     *
     * $queryParams should come from AddressNormalizer::toNominatimQuery().
     *
     * Returns an array with these keys on success:
     *   lat          — latitude as string (Nominatim returns strings)
     *   lon          — longitude as string
     *   display_name — full formatted address string
     *   importance   — float 0.0–1.0 (match confidence)
     *   type         — place type e.g. 'house', 'city'
     *   place_id     — Nominatim internal identifier
     *
     * Returns null if Nominatim returned zero results.
     *
     * Throws NominatimException on HTTP error, timeout, or rate limit.
     *
     * @param  array<string,string|int> $queryParams
     * @return array|null
     *
     * @throws NominatimException
     */
    public function search(array $queryParams): ?array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->withHeaders([
                    'User-Agent' => $this->userAgent,
                    'Accept'     => 'application/json',
                ])
                ->get("{$this->baseUrl}/search", $queryParams);

            // Nominatim returns 429 when rate-limited
            if ($response->status() === 429) {
                Log::warning('[Nominatim] Rate limit hit — job should back off.', [
                    'query' => $queryParams,
                ]);
                throw new NominatimException('Rate limit exceeded', 429);
            }

            if ($response->failed()) {
                throw new NominatimException(
                    "Nominatim HTTP error: {$response->status()}",
                    $response->status()
                );
            }

            $results = $response->json();

            if (! is_array($results) || count($results) === 0) {
                return null;   // no results — not an error, just a miss
            }

            return $results[0];   // take the best match (limit=1)

        } catch (ConnectionException $e) {
            Log::error('[Nominatim] Connection error', [
                'message' => $e->getMessage(),
                'query'   => $queryParams,
            ]);
            throw new NominatimException(
                "Nominatim connection failed: {$e->getMessage()}",
                0,
                $e
            );
        } catch (RequestException $e) {
            Log::error('[Nominatim] Request error', ['message' => $e->getMessage()]);
            throw new NominatimException(
                "Nominatim request error: {$e->getMessage()}",
                $e->response->status() ?? 0,
                $e
            );
        }
    }
}
