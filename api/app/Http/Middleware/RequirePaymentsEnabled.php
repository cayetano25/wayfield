<?php

namespace App\Http\Middleware;

use App\Domain\Payments\Services\PaymentFeatureFlagService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequirePaymentsEnabled
{
    public function __construct(private readonly PaymentFeatureFlagService $flags) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->flags->isPaymentsEnabled()) {
            abort(503, 'Payment features are not currently available.');
        }

        return $next($request);
    }
}
