<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class CheckMaintenanceMode
{
    // Paths that bypass maintenance mode regardless of state.
    private const BYPASS_PREFIXES = [
        'api/platform/',          // Command Center is never blocked
        'api/v1/system/announcements', // must always be readable
        'api/v1/auth/login',
        'api/v1/auth/logout',
        'api/webhooks',
        'up',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        foreach (self::BYPASS_PREFIXES as $prefix) {
            if (str_starts_with($request->path(), $prefix)) {
                return $next($request);
            }
        }

        $active = Cache::remember('maintenance_mode_active', 30, function () {
            if (! Schema::hasTable('platform_config')) {
                return false;
            }

            $value = DB::table('platform_config')
                ->where('config_key', 'maintenance_mode')
                ->value('config_value');

            return $value === 'true';
        });

        if (! $active) {
            return $next($request);
        }

        $message = Cache::remember('maintenance_message', 30, function () {
            return DB::table('platform_config')
                ->where('config_key', 'maintenance_message')
                ->value('config_value')
                ?? 'Wayfield is undergoing scheduled maintenance. We\'ll be back shortly.';
        });

        $endsAt = DB::table('platform_config')
            ->where('config_key', 'maintenance_ends_at')
            ->value('config_value');

        return response()->json([
            'error'       => 'maintenance_mode',
            'message'     => $message,
            'ends_at'     => $endsAt,
            'retry_after' => 300,
        ], 503, [
            'Retry-After'         => 300,
            'X-Maintenance-Mode'  => 'true',
        ]);
    }
}
