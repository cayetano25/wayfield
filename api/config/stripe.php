<?php

return [
    'secret_key'             => env('STRIPE_SECRET_KEY'),
    'publishable_key'        => env('STRIPE_PUBLISHABLE_KEY'),
    'webhook_secret'         => env('STRIPE_WEBHOOK_SECRET'),
    'connect_webhook_secret' => env('STRIPE_CONNECT_WEBHOOK_SECRET'),
    'client_id'              => env('STRIPE_CLIENT_ID'),
];
