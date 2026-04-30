<?php

use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\OrderItem;
use App\Domain\Payments\Models\RefundRequest;
use App\Jobs\SendReceiptEmailJob;
use App\Models\Organization;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Counter makes each order number unique within a test run. */
function historyOrder(User $user, Organization $org, array $attrs = []): Order
{
    static $seq = 0;
    $seq++;

    return Order::create(array_merge([
        'order_number'           => 'WF-2026-' . str_pad($seq, 6, '0', STR_PAD_LEFT),
        'user_id'                => $user->id,
        'organization_id'        => $org->id,
        'status'                 => 'completed',
        'payment_method'         => 'stripe',
        'subtotal_cents'         => 10000,
        'wayfield_fee_cents'     => 500,
        'stripe_fee_cents'       => 320,
        'total_cents'            => 10000,
        'organizer_payout_cents' => 9180,
        'take_rate_pct'          => 0.05,
        'currency'               => 'usd',
        'is_deposit_order'       => false,
        'completed_at'           => now(),
    ], $attrs));
}

function historyUser(): array
{
    return [User::factory()->create(), Organization::factory()->create()];
}

// ─── GET /me/orders ───────────────────────────────────────────────────────────

it('returns only the authenticated user\'s orders', function () {
    [$user, $org]  = historyUser();
    [$other, $org2] = historyUser();

    historyOrder($user, $org);
    historyOrder($user, $org);
    historyOrder($other, $org2);

    $this->actingAs($user)
        ->getJson('/api/v1/me/orders')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.total', 2);
});

it('does not return other users\' orders', function () {
    [$user, $org]  = historyUser();
    [$other, $org2] = historyUser();

    historyOrder($other, $org2);

    $this->actingAs($user)
        ->getJson('/api/v1/me/orders')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

it('requires authentication', function () {
    $this->getJson('/api/v1/me/orders')->assertUnauthorized();
});

it('filters by status=completed', function () {
    [$user, $org] = historyUser();

    historyOrder($user, $org, ['status' => 'completed']);
    historyOrder($user, $org, ['status' => 'cancelled', 'completed_at' => null]);

    $this->actingAs($user)
        ->getJson('/api/v1/me/orders?status=completed')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.status', 'completed');
});

it('filters status=refunded to include partially_refunded and fully_refunded', function () {
    [$user, $org] = historyUser();

    historyOrder($user, $org, ['status' => 'partially_refunded']);
    historyOrder($user, $org, ['status' => 'fully_refunded']);
    historyOrder($user, $org, ['status' => 'completed']);

    $this->actingAs($user)
        ->getJson('/api/v1/me/orders?status=refunded')
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

it('filters by year', function () {
    [$user, $org] = historyUser();

    historyOrder($user, $org, ['completed_at' => '2025-06-15 10:00:00']);
    historyOrder($user, $org, ['completed_at' => '2026-03-01 10:00:00']);

    $this->actingAs($user)
        ->getJson('/api/v1/me/orders?year=2026')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

it('returns per_page pagination and respects max of 50', function () {
    [$user, $org] = historyUser();

    for ($i = 0; $i < 5; $i++) {
        historyOrder($user, $org);
    }

    $this->actingAs($user)
        ->getJson('/api/v1/me/orders?per_page=2')
        ->assertOk()
        ->assertJsonPath('meta.last_page', 3);

    // Clamped to 50 even if client sends 999
    $this->actingAs($user)
        ->getJson('/api/v1/me/orders?per_page=999')
        ->assertOk()
        ->assertJsonCount(5, 'data');
});

it('meta.total_spent sums only completed orders', function () {
    [$user, $org] = historyUser();

    historyOrder($user, $org, ['status' => 'completed', 'total_cents' => 5000]);
    historyOrder($user, $org, ['status' => 'completed', 'total_cents' => 3000]);
    historyOrder($user, $org, ['status' => 'cancelled', 'total_cents' => 9999, 'completed_at' => null]);

    $this->actingAs($user)
        ->getJson('/api/v1/me/orders')
        ->assertOk()
        ->assertJsonPath('meta.total_spent', '$80.00');
});

it('includes organization name and logo_url in each order', function () {
    [$user, $org] = historyUser();
    $org->update(['logo_url' => 'https://cdn.example.com/logo.png']);
    historyOrder($user, $org);

    $response = $this->actingAs($user)->getJson('/api/v1/me/orders')->assertOk();

    expect($response->json('data.0.organization.name'))->toBe($org->name);
    expect($response->json('data.0.organization.logo_url'))->toBe('https://cdn.example.com/logo.png');
});

// ─── GET /me/orders/{orderNumber} ────────────────────────────────────────────

it('returns full detail for the user\'s own order', function () {
    [$user, $org] = historyUser();
    $order = historyOrder($user, $org);

    $this->actingAs($user)
        ->getJson("/api/v1/me/orders/{$order->order_number}")
        ->assertOk()
        ->assertJsonPath('data.order_number', $order->order_number)
        ->assertJsonPath('data.status', 'completed')
        ->assertJsonStructure(['data' => [
            'id', 'order_number', 'status', 'status_label',
            'total', 'total_cents', 'currency', 'payment_method',
            'organization', 'items',
            'wayfield_fee_cents', 'stripe_fee_cents', 'discount_cents',
            'coupon', 'refund_requests', 'can_request_refund', 'receipt_url',
        ]]);
});

it('returns 404 for another user\'s order', function () {
    [$user, $org]   = historyUser();
    [$other, $org2] = historyUser();
    $order = historyOrder($other, $org2);

    $this->actingAs($user)
        ->getJson("/api/v1/me/orders/{$order->order_number}")
        ->assertNotFound();
});

it('returns 404 for a nonexistent order number', function () {
    [$user] = historyUser();

    $this->actingAs($user)
        ->getJson('/api/v1/me/orders/WF-9999-XXXXX')
        ->assertNotFound();
});

it('can_request_refund is true for a completed order with no pending request', function () {
    [$user, $org] = historyUser();
    $order = historyOrder($user, $org, ['status' => 'completed']);

    $this->actingAs($user)
        ->getJson("/api/v1/me/orders/{$order->order_number}")
        ->assertOk()
        ->assertJsonPath('data.can_request_refund', true);
});

it('can_request_refund is false when a pending refund request exists', function () {
    [$user, $org] = historyUser();
    $order = historyOrder($user, $org, ['status' => 'completed']);

    RefundRequest::create([
        'order_id'               => $order->id,
        'requested_by_user_id'   => $user->id,
        'reason_code'            => 'cancellation',
        'requested_amount_cents' => 10000,
        'status'                 => 'pending',
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/me/orders/{$order->order_number}")
        ->assertOk()
        ->assertJsonPath('data.can_request_refund', false);
});

it('can_request_refund is false for a cancelled order', function () {
    [$user, $org] = historyUser();
    $order = historyOrder($user, $org, ['status' => 'cancelled', 'completed_at' => null]);

    $this->actingAs($user)
        ->getJson("/api/v1/me/orders/{$order->order_number}")
        ->assertOk()
        ->assertJsonPath('data.can_request_refund', false);
});

it('includes refund_requests in detail view', function () {
    [$user, $org] = historyUser();
    $order = historyOrder($user, $org, ['status' => 'partially_refunded']);

    RefundRequest::create([
        'order_id'               => $order->id,
        'requested_by_user_id'   => $user->id,
        'reason_code'            => 'cancellation',
        'requested_amount_cents' => 5000,
        'approved_amount_cents'  => 5000,
        'status'                 => 'organizer_approved',
        'processed_at'           => now(),
    ]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/me/orders/{$order->order_number}")
        ->assertOk();

    expect($response->json('data.refund_requests'))->toHaveCount(1);
    expect($response->json('data.refund_requests.0.status'))->toBe('organizer_approved');
    expect($response->json('data.refund_requests.0.requested_amount'))->toBe('$50.00');
});

// ─── POST /me/orders/{orderNumber}/resend-receipt ─────────────────────────────

it('dispatches SendReceiptEmailJob and returns 200 for own completed order', function () {
    Queue::fake();

    [$user, $org] = historyUser();
    $order = historyOrder($user, $org, ['status' => 'completed']);

    $this->actingAs($user)
        ->postJson("/api/v1/me/orders/{$order->order_number}/resend-receipt")
        ->assertOk()
        ->assertJsonPath('message', 'Receipt sent to your email address.');

    Queue::assertPushed(SendReceiptEmailJob::class);
});

it('returns 429 on second resend-receipt within an hour', function () {
    Queue::fake();

    [$user, $org] = historyUser();
    $order = historyOrder($user, $org, ['status' => 'completed']);

    $this->actingAs($user)
        ->postJson("/api/v1/me/orders/{$order->order_number}/resend-receipt")
        ->assertOk();

    $this->actingAs($user)
        ->postJson("/api/v1/me/orders/{$order->order_number}/resend-receipt")
        ->assertStatus(429);

    Queue::assertPushed(SendReceiptEmailJob::class, 1);
});

it('returns 404 when resend-receipt targets another user\'s order', function () {
    Queue::fake();

    [$user, $org]   = historyUser();
    [$other, $org2] = historyUser();
    $order = historyOrder($other, $org2, ['status' => 'completed']);

    $this->actingAs($user)
        ->postJson("/api/v1/me/orders/{$order->order_number}/resend-receipt")
        ->assertNotFound();

    Queue::assertNotPushed(SendReceiptEmailJob::class);
});

it('returns 404 when resend-receipt targets a non-completed order', function () {
    Queue::fake();

    [$user, $org] = historyUser();
    $order = historyOrder($user, $org, ['status' => 'pending', 'completed_at' => null]);

    $this->actingAs($user)
        ->postJson("/api/v1/me/orders/{$order->order_number}/resend-receipt")
        ->assertNotFound();

    Queue::assertNotPushed(SendReceiptEmailJob::class);
});
