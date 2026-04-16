<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'stripe' => [
        'secret' => env('STRIPE_SECRET_KEY'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    ],

    'aws' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
        'bucket' => env('AWS_BUCKET'),
        'cloudfront_url' => env('AWS_CLOUDFRONT_URL'),
    ],

    'nominatim' => [
        'base_url'   => env('NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org'),
        'user_agent' => env('NOMINATIM_USER_AGENT', 'Wayfield/1.0 (contact@wayfield.app)'),
        'timeout'    => (int) env('NOMINATIM_TIMEOUT_SECONDS', 10),
        'retries'    => (int) env('NOMINATIM_MAX_RETRIES', 2),
    ],

    'geocoding' => [
        'provider'             => env('GEOCODING_PROVIDER', 'nominatim'),
        'cache_ttl_days'       => (int) env('GEOCODE_CACHE_TTL_DAYS', 90),
        'failed_ttl_hours'     => (int) env('GEOCODE_FAILED_TTL_HOURS', 24),
        'max_attempts'         => (int) env('GEOCODE_MAX_ATTEMPTS', 3),
        // Nominatim policy: max 1 request/second.
        // This delay is added between queue job retries and should be
        // enforced at the queue dispatcher level.
        'queue_delay_seconds'  => (int) env('GEOCODE_QUEUE_DELAY_SECONDS', 2),
    ],

];
