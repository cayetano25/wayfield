<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Plan Display Names
    |--------------------------------------------------------------------------
    | Maps DB enum values to marketing display names.
    | DB enum values (free, starter, pro, enterprise) never change.
    | Display names can be updated here without touching the database.
    */
    'display_names' => [
        'free' => 'Foundation',
        'starter' => 'Creator',
        'pro' => 'Studio',
        'enterprise' => 'Enterprise',
    ],

    /*
    |--------------------------------------------------------------------------
    | Plan Pricing
    |--------------------------------------------------------------------------
    | monthly_cents:            price in cents for monthly billing
    | annual_cents:             price in cents for annual billing (per-month equivalent)
    | annual_discount_pct:      percentage saved on annual vs monthly
    | stripe_monthly_price_id:  Stripe Price ID for monthly billing (set in .env)
    | stripe_annual_price_id:   Stripe Price ID for annual billing  (set in .env)
    |
    | null = not applicable (Free has no Stripe price; Enterprise is custom/contact sales).
    */
    'pricing' => [
        'free' => [
            'monthly_cents' => 0,
            'annual_cents' => 0,
            'annual_discount_pct' => 0,
            'stripe_monthly_price_id' => null,
            'stripe_annual_price_id' => null,
        ],
        'starter' => [
            'monthly_cents' => 4900,   // $49.00/mo
            'annual_cents' => 4165,   // ~$41.65/mo billed annually ($499.80/yr)
            'annual_discount_pct' => 15,
            'stripe_monthly_price_id' => env('STRIPE_PRICE_CREATOR_MONTHLY'),
            'stripe_annual_price_id' => env('STRIPE_PRICE_CREATOR_ANNUAL'),
        ],
        'pro' => [
            'monthly_cents' => 14900,  // $149.00/mo
            'annual_cents' => 12665,  // ~$126.65/mo billed annually ($1519.80/yr)
            'annual_discount_pct' => 15,
            'stripe_monthly_price_id' => env('STRIPE_PRICE_STUDIO_MONTHLY'),
            'stripe_annual_price_id' => env('STRIPE_PRICE_STUDIO_ANNUAL'),
        ],
        'enterprise' => [
            'monthly_cents' => null,   // Custom pricing — contact sales
            'annual_cents' => null,
            'annual_discount_pct' => 0,
            'stripe_monthly_price_id' => null,
            'stripe_annual_price_id' => null,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Plan Limits
    |--------------------------------------------------------------------------
    | null = unlimited.
    | These are enforced at the API layer by EnforceFeatureGateService.
    | Never enforce limits in UI only.
    */
    'limits' => [
        'free' => [
            'organizations' => 1,
            'organizers' => 1,
            'active_workshops' => 2,
            'participants_per_workshop' => 75,
        ],
        'starter' => [
            'organizations' => 1,
            'organizers' => 5,
            'active_workshops' => 10,
            'participants_per_workshop' => 250,
        ],
        'pro' => [
            'organizations' => 3,
            'organizers' => null,
            'active_workshops' => null,
            'participants_per_workshop' => null,
        ],
        'enterprise' => [
            'organizations' => null,
            'organizers' => null,
            'active_workshops' => null,
            'participants_per_workshop' => null,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Plan Features
    |--------------------------------------------------------------------------
    | true  = included in this plan
    | false = not included
    |
    | IMPORTANT: custom_branding is Studio (pro) and above only.
    | It is NOT included in Creator (starter) — this is intentional.
    */
    'features' => [
        'free' => [
            'scheduling' => true,
            'session_selection' => true,
            'self_check_in' => true,
            'offline_access' => true,
            'leader_invitations' => true,
            'basic_notifications' => true,
            'capacity_enforcement' => false,
            'waitlists' => false,
            'reminder_automation' => false,
            'basic_analytics' => false,
            'attendance_summaries' => false,
            'leader_day_notifications' => false,
            'advanced_automation' => false,
            'segmentation' => false,
            'multi_workshop_reporting' => false,
            'api_access' => false,
            'webhooks' => false,
            'advanced_permissions' => false,
            'custom_branding' => false,  // Foundation: no custom branding
            'sso' => false,
            'white_label' => false,
        ],
        'starter' => [
            'scheduling' => true,
            'session_selection' => true,
            'self_check_in' => true,
            'offline_access' => true,
            'leader_invitations' => true,
            'basic_notifications' => true,
            'capacity_enforcement' => true,
            'waitlists' => true,
            'reminder_automation' => true,
            'basic_analytics' => true,
            'attendance_summaries' => true,
            'leader_day_notifications' => true,
            'advanced_automation' => false,
            'segmentation' => false,
            'multi_workshop_reporting' => false,
            'api_access' => false,
            'webhooks' => false,
            'advanced_permissions' => false,
            'custom_branding' => false,  // Creator: NO custom branding
            'sso' => false,
            'white_label' => false,
        ],
        'pro' => [
            'scheduling' => true,
            'session_selection' => true,
            'self_check_in' => true,
            'offline_access' => true,
            'leader_invitations' => true,
            'basic_notifications' => true,
            'capacity_enforcement' => true,
            'waitlists' => true,
            'reminder_automation' => true,
            'basic_analytics' => true,
            'attendance_summaries' => true,
            'leader_day_notifications' => true,
            'advanced_automation' => true,
            'segmentation' => true,
            'multi_workshop_reporting' => true,
            'api_access' => true,
            'webhooks' => true,
            'advanced_permissions' => true,
            'custom_branding' => true,   // Studio: custom branding included
            'sso' => false,
            'white_label' => false,
        ],
        'enterprise' => [
            'scheduling' => true,
            'session_selection' => true,
            'self_check_in' => true,
            'offline_access' => true,
            'leader_invitations' => true,
            'basic_notifications' => true,
            'capacity_enforcement' => true,
            'waitlists' => true,
            'reminder_automation' => true,
            'basic_analytics' => true,
            'attendance_summaries' => true,
            'leader_day_notifications' => true,
            'advanced_automation' => true,
            'segmentation' => true,
            'multi_workshop_reporting' => true,
            'api_access' => true,
            'webhooks' => true,
            'advanced_permissions' => true,
            'custom_branding' => true,
            'sso' => true,
            'white_label' => true,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Plan Order
    |--------------------------------------------------------------------------
    | Used by upgrade/downgrade logic to determine direction of plan change.
    | Index 0 is lowest, index 3 is highest.
    */
    'order' => ['free', 'starter', 'pro', 'enterprise'],

];
