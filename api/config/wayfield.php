<?php

return [
    /*
    |--------------------------------------------------------------------------
    | API Key Rate Limit
    |--------------------------------------------------------------------------
    |
    | Maximum requests per hour for each API key.
    | Set to a low value in testing environments to make rate limit tests fast.
    |
    */
    'api_key_rate_limit' => (int) env('API_KEY_RATE_LIMIT', 1000),
];
