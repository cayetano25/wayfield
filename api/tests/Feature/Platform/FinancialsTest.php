<?php

use App\Models\AdminUser;
use App\Models\Organization;
use App\Models\StripeInvoice;
use App\Models\StripeSubscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function finAdmin(string $role = 'super_admin'): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name'    => 'Fin',
        'last_name'     => "Admin{$seq}",
        'email'         => "fin{$seq}@wayfield.internal",
        'password_hash' => Hash::make('pass'),
        'role'          => $role,
        'is_active'     => true,
    ]);
}

function finToken(AdminUser $admin): string
{
    return $admin->createToken('platform_token', ['platform:*'])->plainTextToken;
}

function makeStripeSubscription(Organization $org, string $plan, string $status = 'active'): StripeSubscription
{
    static $subSeq = 0;
    $subSeq++;

    return StripeSubscription::create([
        'organization_id'        => $org->id,
        'stripe_customer_id'     => "cus_test_{$subSeq}",
        'stripe_subscription_id' => "sub_test_{$subSeq}",
        'stripe_price_id'        => "price_{$plan}",
        'plan_code'              => $plan,
        'status'                 => $status,
        'current_period_start'   => now()->subMonth(),
        'current_period_end'     => now()->addMonth(),
    ]);
}

function makeStripeInvoice(Organization $org, string $status = 'paid', int $amountDue = 4900): StripeInvoice
{
    static $invoiceSeq = 0;
    $invoiceSeq++;

    return StripeInvoice::create([
        'organization_id'    => $org->id,
        'stripe_invoice_id'  => "in_test_{$invoiceSeq}",
        'stripe_customer_id' => "cus_inv_{$invoiceSeq}",
        'amount_due'         => $amountDue,
        'amount_paid'        => $status === 'paid' ? $amountDue : 0,
        'currency'           => 'usd',
        'status'             => $status,
        'period_start'       => now()->subMonth(),
        'period_end'         => now(),
    ]);
}

// ─── GET /financials/overview ─────────────────────────────────────────────────

test('GET /financials/overview returns correct shape', function () {
    $admin = finAdmin();

    $this->withToken(finToken($admin))
        ->getJson('/api/platform/v1/financials/overview')
        ->assertStatus(200)
        ->assertJsonStructure([
            'mrr_cents', 'arr_cents',
            'subscriptions' => [
                'active', 'trialing', 'past_due', 'canceled',
                'by_plan' => ['free', 'starter', 'pro', 'enterprise'],
            ],
            'stripe_webhook_connected',
        ]);
});

test('GET /financials/overview mrr_cents is null when no subscriptions exist', function () {
    $admin = finAdmin();

    $this->withToken(finToken($admin))
        ->getJson('/api/platform/v1/financials/overview')
        ->assertStatus(200)
        ->assertJsonPath('mrr_cents', null)
        ->assertJsonPath('arr_cents', null);
});

test('GET /financials/overview mrr_cents sums active plan prices', function () {
    $admin = finAdmin();
    $org1  = Organization::factory()->create();
    $org2  = Organization::factory()->create();
    $org3  = Organization::factory()->create();

    makeStripeSubscription($org1, 'starter', 'active');   // 4900
    makeStripeSubscription($org2, 'pro', 'active');       // 12900
    makeStripeSubscription($org3, 'starter', 'canceled'); // excluded

    $this->withToken(finToken($admin))
        ->getJson('/api/platform/v1/financials/overview')
        ->assertStatus(200)
        ->assertJsonPath('mrr_cents', 17800)   // 4900 + 12900
        ->assertJsonPath('arr_cents', 17800 * 12);
});

test('GET /financials/overview stripe_webhook_connected is false when no processed events', function () {
    $admin = finAdmin();

    $this->withToken(finToken($admin))
        ->getJson('/api/platform/v1/financials/overview')
        ->assertStatus(200)
        ->assertJsonPath('stripe_webhook_connected', false);
});

test('GET /financials/overview stripe_webhook_connected is true when processed events exist', function () {
    $admin = finAdmin();

    DB::table('stripe_events')->insert([
        'stripe_event_id' => 'evt_test_001',
        'event_type'      => 'invoice.paid',
        'payload_json'    => '{}',
        'processed_at'    => now(),
        'created_at'      => now(),
    ]);

    $this->withToken(finToken($admin))
        ->getJson('/api/platform/v1/financials/overview')
        ->assertStatus(200)
        ->assertJsonPath('stripe_webhook_connected', true);
});

test('GET /financials/overview subscription counts are correct', function () {
    $admin = finAdmin();
    $orgs  = Organization::factory()->count(5)->create();

    makeStripeSubscription($orgs[0], 'starter', 'active');
    makeStripeSubscription($orgs[1], 'pro',     'active');
    makeStripeSubscription($orgs[2], 'starter', 'trialing');
    makeStripeSubscription($orgs[3], 'starter', 'past_due');
    makeStripeSubscription($orgs[4], 'free',    'canceled');

    $this->withToken(finToken($admin))
        ->getJson('/api/platform/v1/financials/overview')
        ->assertStatus(200)
        ->assertJsonPath('subscriptions.active',   2)
        ->assertJsonPath('subscriptions.trialing', 1)
        ->assertJsonPath('subscriptions.past_due', 1)
        ->assertJsonPath('subscriptions.canceled', 1)
        ->assertJsonPath('subscriptions.by_plan.starter', 2)  // active + trialing
        ->assertJsonPath('subscriptions.by_plan.pro',     1);
});

// ─── GET /financials/invoices ─────────────────────────────────────────────────

test('GET /financials/invoices returns paginated list', function () {
    $admin = finAdmin();
    $org   = Organization::factory()->create();
    makeStripeInvoice($org, 'paid');
    makeStripeInvoice($org, 'open');

    $this->withToken(finToken($admin))
        ->getJson('/api/platform/v1/financials/invoices')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [['id', 'stripe_invoice_id', 'organization_id', 'organization_name',
                        'amount_due', 'amount_paid', 'currency', 'status', 'invoice_pdf_url', 'invoice_date']],
            'total', 'per_page',
        ])
        ->assertJsonPath('total', 2);
});

test('GET /financials/invoices?status=paid filters correctly', function () {
    $admin = finAdmin();
    $org   = Organization::factory()->create();
    makeStripeInvoice($org, 'paid');
    makeStripeInvoice($org, 'open');
    makeStripeInvoice($org, 'paid');

    $this->withToken(finToken($admin))
        ->getJson('/api/platform/v1/financials/invoices?status=paid')
        ->assertStatus(200)
        ->assertJsonPath('total', 2);
});

test('GET /financials/invoices includes organization name', function () {
    $admin = finAdmin();
    $org   = Organization::factory()->create(['name' => 'Cascade Photo Workshops']);
    makeStripeInvoice($org, 'paid');

    $this->withToken(finToken($admin))
        ->getJson('/api/platform/v1/financials/invoices')
        ->assertStatus(200)
        ->assertJsonPath('data.0.organization_name', 'Cascade Photo Workshops');
});

// ─── Auth isolation ────────────────────────────────────────────────────────────

test('GET /financials/overview is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/financials/overview')
        ->assertStatus(401);
});

test('GET /financials/invoices is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/financials/invoices')
        ->assertStatus(401);
});

test('GET /financials/overview is rejected for support role', function () {
    $admin = finAdmin('support');

    $this->withToken(finToken($admin))
        ->getJson('/api/platform/v1/financials/overview')
        ->assertStatus(403);
});

test('GET /financials/overview requires authentication', function () {
    $this->getJson('/api/platform/v1/financials/overview')->assertStatus(401);
});
