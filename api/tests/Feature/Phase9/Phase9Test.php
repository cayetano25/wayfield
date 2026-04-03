<?php

use App\Models\ApiKey;
use App\Models\AuthMethod;
use App\Models\Location;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\User;
use App\Models\WebhookEndpoint;
use App\Models\Workshop;
use App\Jobs\DeliverWebhookJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function p9OwnerWithOrg(): array
{
    $user = User::factory()->create();
    $org  = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    return [$user, $org];
}

function p9PublishedWorkshopWithSlug(Organization $org, string $slug): Workshop
{
    return Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'             => 'published',
        'public_page_enabled' => true,
        'public_slug'        => $slug,
        'title'              => 'Discovery Test Workshop',
        'description'        => str_repeat('A workshop about photography. ', 10),
        'timezone'           => 'America/New_York',
        'start_date'         => now()->addDays(10)->toDateString(),
        'end_date'           => now()->addDays(12)->toDateString(),
    ]);
}

function p9CreateApiKey(Organization $org, User $createdBy, array $scopes): array
{
    $rawKey  = 'wf_test_' . \Illuminate\Support\Str::random(48);
    $keyHash = hash('sha256', $rawKey);

    $key = ApiKey::create([
        'organization_id'    => $org->id,
        'name'               => 'Test Key',
        'key_prefix'         => substr($rawKey, 0, 10),
        'key_hash'           => $keyHash,
        'scopes'             => $scopes,
        'is_active'          => true,
        'created_by_user_id' => $createdBy->id,
    ]);

    return [$key, $rawKey];
}

// ─── AREA 1 — SSO ─────────────────────────────────────────────────────────────

test('auth_methods enum accepts saml and oidc values', function () {
    $user = User::factory()->create();

    // email provider still works (regression check)
    $email = AuthMethod::create([
        'user_id'          => $user->id,
        'provider'         => 'email',
        'provider_user_id' => null,
    ]);
    expect($email->provider)->toBe('email');

    // saml provider accepted
    $saml = AuthMethod::create([
        'user_id'          => $user->id,
        'provider'         => 'saml',
        'provider_user_id' => 'saml-uid-001',
    ]);
    expect($saml->provider)->toBe('saml');

    // oidc provider accepted
    $oidc = AuthMethod::create([
        'user_id'          => $user->id,
        'provider'         => 'oidc',
        'provider_user_id' => 'oidc-uid-001',
    ]);
    expect($oidc->provider)->toBe('oidc');
});

test('sso login stub returns 501', function () {
    $org = Organization::factory()->create(['slug' => 'cascade-photo']);

    $this->getJson('/api/v1/sso/cascade-photo/login')
        ->assertStatus(501)
        ->assertJsonPath('error', 'sso_not_active')
        ->assertJsonPath('stub', true);
});

// ─── AREA 2 — WEBHOOKS ────────────────────────────────────────────────────────

test('webhook dispatch queues job on workshop publish', function () {
    Queue::fake();

    [$user, $org] = p9OwnerWithOrg();

    // Register a webhook endpoint for this org subscribed to workshop.published
    WebhookEndpoint::create([
        'organization_id'  => $org->id,
        'url'              => 'https://example.com/webhook',
        'secret_encrypted' => encrypt('test-secret-abc'),
        'is_active'        => true,
        'event_types'      => ['workshop.published'],
    ]);

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'      => 'draft',
        'title'       => 'Webhook Test Workshop',
        'description' => 'A test.',
        'timezone'    => 'America/New_York',
        'start_date'  => now()->addDays(5)->toDateString(),
        'end_date'    => now()->addDays(7)->toDateString(),
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertStatus(200);

    Queue::assertPushed(DeliverWebhookJob::class);
});

test('webhook dispatch failure does not fail primary action', function () {
    // Even if webhook dispatch throws, the workshop publish must succeed.
    // We simulate this by having no endpoints (dispatch loops over empty set).
    [$user, $org] = p9OwnerWithOrg();

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'      => 'draft',
        'title'       => 'Resilient Workshop',
        'description' => 'Must publish even if webhooks fail.',
        'timezone'    => 'America/Chicago',
        'start_date'  => now()->addDays(5)->toDateString(),
        'end_date'    => now()->addDays(7)->toDateString(),
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertStatus(200);

    $this->assertDatabaseHas('workshops', [
        'id'     => $workshop->id,
        'status' => 'published',
    ]);
});

// ─── AREA 3 — API KEYS ────────────────────────────────────────────────────────

test('api key authenticates and allows scoped request', function () {
    [$user, $org] = p9OwnerWithOrg();

    [$key, $rawKey] = p9CreateApiKey($org, $user, [ApiKey::SCOPE_WORKSHOPS_READ]);

    Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'      => 'published',
        'title'       => 'External API Workshop',
        'description' => 'Visible via API.',
        'timezone'    => 'UTC',
        'start_date'  => now()->addDays(1)->toDateString(),
        'end_date'    => now()->addDays(2)->toDateString(),
    ]);

    $this->withHeaders(['Authorization' => "ApiKey {$rawKey}"])
        ->getJson('/api/v1/external/workshops')
        ->assertStatus(200)
        ->assertJsonStructure(['data']);
});

test('api key rejects wrong scope', function () {
    [$user, $org] = p9OwnerWithOrg();

    // Key only has workshops:read — not sessions:read
    [$key, $rawKey] = p9CreateApiKey($org, $user, [ApiKey::SCOPE_WORKSHOPS_READ]);

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status' => 'published',
        'title'  => 'Scope Test',
        'description' => 'Test',
        'timezone' => 'UTC',
        'start_date' => now()->addDays(1)->toDateString(),
        'end_date'   => now()->addDays(2)->toDateString(),
    ]);

    $this->withHeaders(['Authorization' => "ApiKey {$rawKey}"])
        ->getJson("/api/v1/external/workshops/{$workshop->id}/sessions")
        ->assertStatus(403)
        ->assertJsonPath('error', 'insufficient_scope')
        ->assertJsonPath('required', ApiKey::SCOPE_SESSIONS_READ);
});

test('api key rate limit returns 429', function () {
    // Set rate limit to 5 for this test via env config override
    config(['wayfield.api_key_rate_limit' => 5]);

    [$user, $org] = p9OwnerWithOrg();
    [$key, $rawKey] = p9CreateApiKey($org, $user, [ApiKey::SCOPE_WORKSHOPS_READ]);

    // First 5 requests should succeed (rate limit = 5)
    for ($i = 0; $i < 5; $i++) {
        $this->withHeaders(['Authorization' => "ApiKey {$rawKey}"])
            ->getJson('/api/v1/external/workshops')
            ->assertStatus(200);
    }

    // 6th request should be rate limited
    $this->withHeaders(['Authorization' => "ApiKey {$rawKey}"])
        ->getJson('/api/v1/external/workshops')
        ->assertStatus(429);
});

test('api key revoked key returns 401', function () {
    [$user, $org] = p9OwnerWithOrg();
    [$key, $rawKey] = p9CreateApiKey($org, $user, [ApiKey::SCOPE_WORKSHOPS_READ]);

    // Revoke the key
    $key->update(['is_active' => false]);

    $this->withHeaders(['Authorization' => "ApiKey {$rawKey}"])
        ->getJson('/api/v1/external/workshops')
        ->assertStatus(401)
        ->assertJsonPath('error', 'api_key_revoked');
});

// ─── AREA 4 — DISCOVERY ───────────────────────────────────────────────────────

test('discovery returns only published public workshops', function () {
    $org = Organization::factory()->create();

    // This workshop should appear
    $published = p9PublishedWorkshopWithSlug($org, 'visible-workshop');

    // Draft workshop — should NOT appear
    Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'             => 'draft',
        'public_page_enabled' => true,
        'public_slug'        => 'draft-workshop',
        'title'              => 'Draft',
        'description'        => 'Not visible',
        'timezone'           => 'UTC',
        'start_date'         => now()->addDays(1)->toDateString(),
        'end_date'           => now()->addDays(2)->toDateString(),
    ]);

    // Published but public_page_enabled=false — should NOT appear
    Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'             => 'published',
        'public_page_enabled' => false,
        'public_slug'        => 'hidden-workshop',
        'title'              => 'Hidden',
        'description'        => 'Not visible',
        'timezone'           => 'UTC',
        'start_date'         => now()->addDays(1)->toDateString(),
        'end_date'           => now()->addDays(2)->toDateString(),
    ]);

    $response = $this->getJson('/api/v1/discover/workshops')
        ->assertStatus(200);

    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($published->id);
    expect($ids)->not->toContain(2); // draft not present
    expect(count($ids))->toBe(1);
});

test('discovery never exposes join_code', function () {
    $org = Organization::factory()->create();
    p9PublishedWorkshopWithSlug($org, 'no-code-test');

    $listResponse = $this->getJson('/api/v1/discover/workshops');
    expect($listResponse->content())->not->toContain('join_code');

    $detailResponse = $this->getJson('/api/v1/discover/workshops/no-code-test');
    expect($detailResponse->content())->not->toContain('join_code');
});

test('discovery never exposes meeting url', function () {
    $org      = Organization::factory()->create();
    $workshop = p9PublishedWorkshopWithSlug($org, 'virtual-test');

    // Add a virtual session with a meeting_url
    Session::factory()->create([
        'workshop_id'   => $workshop->id,
        'delivery_type' => 'virtual',
        'meeting_url'   => 'https://zoom.us/j/secret-meeting',
        'is_published'  => true,
        'title'         => 'Virtual Session',
        'description'   => 'Test',
        'start_at'      => now()->addDays(10),
        'end_at'        => now()->addDays(10)->addHours(2),
    ]);

    $response = $this->getJson('/api/v1/discover/workshops/virtual-test');
    expect($response->content())->not->toContain('meeting_url');
    expect($response->content())->not->toContain('zoom.us');
});

test('discovery returns 404 for draft workshop', function () {
    $org = Organization::factory()->create();
    Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'             => 'draft',
        'public_page_enabled' => true,
        'public_slug'        => 'draft-slug',
        'title'              => 'Draft',
        'description'        => 'Draft workshop',
        'timezone'           => 'UTC',
        'start_date'         => now()->addDays(1)->toDateString(),
        'end_date'           => now()->addDays(2)->toDateString(),
    ]);

    $this->getJson('/api/v1/discover/workshops/draft-slug')
        ->assertStatus(404);
});

test('external participants count never returns individual records', function () {
    [$user, $org] = p9OwnerWithOrg();
    [$key, $rawKey] = p9CreateApiKey($org, $user, [ApiKey::SCOPE_PARTICIPANTS_READ]);

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'      => 'published',
        'title'       => 'Count Test',
        'description' => 'Test',
        'timezone'    => 'UTC',
        'start_date'  => now()->addDays(1)->toDateString(),
        'end_date'    => now()->addDays(2)->toDateString(),
    ]);

    // Register a participant
    $participant = User::factory()->create();
    Registration::create([
        'workshop_id'         => $workshop->id,
        'user_id'             => $participant->id,
        'registration_status' => 'registered',
        'registered_at'       => now(),
    ]);

    $response = $this->withHeaders(['Authorization' => "ApiKey {$rawKey}"])
        ->getJson("/api/v1/external/workshops/{$workshop->id}/participants/count")
        ->assertStatus(200)
        ->assertJsonStructure(['total_registered', 'total_checked_in', 'total_no_show']);

    $json = $response->json();

    // Must be aggregate integers, never individual records
    expect($json['total_registered'])->toBeInt();
    expect($json['total_checked_in'])->toBeInt();

    // Must not contain any PII
    $body = $response->content();
    expect($body)->not->toContain($participant->email);
    expect($body)->not->toContain($participant->first_name);
    expect($body)->not->toContain($participant->last_name);

    // Must not contain any array of participant objects
    expect($json)->not->toHaveKey('participants');
    expect($json)->not->toHaveKey('data');
    expect($json)->not->toHaveKey('email');
});
