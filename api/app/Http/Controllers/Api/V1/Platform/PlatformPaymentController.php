<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Domain\Payments\Models\PaymentFeatureFlag;
use App\Domain\Shared\Services\AuditLogService;
use App\Http\Controllers\Controller;
use App\Mail\Payments\PaymentsEnabledForOrgMail;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class PlatformPaymentController extends Controller
{
    /**
     * POST /api/v1/platform/organizations/{organization}/enable-payments
     * Auth: platform admin (admin_users only — tenant tokens rejected)
     *
     * Sets org_payments_enabled = true, records timestamps, notifies org owner/admins.
     */
    public function enablePayments(Request $request, Organization $organization): JsonResponse
    {
        $adminUser = $request->user();

        $flag = PaymentFeatureFlag::updateOrCreate(
            [
                'scope'           => 'organization',
                'organization_id' => $organization->id,
                'flag_key'        => 'org_payments_enabled',
            ],
            [
                'is_enabled'         => true,
                'enabled_at'         => now(),
                'enabled_by_user_id' => null, // platform admin users are admin_users, not users
                'notes'              => 'Enabled by platform admin: '.$adminUser->email,
            ],
        );

        AuditLogService::record([
            'organization_id' => $organization->id,
            'entity_type'     => 'payment_feature_flag',
            'entity_id'       => $flag->id,
            'action'          => 'org_payments_enabled',
            'metadata'        => [
                'flag_key'         => 'org_payments_enabled',
                'platform_admin'   => $adminUser->email,
            ],
        ]);

        // N-47: Notify all active org owners and admins.
        $organization->users()
            ->wherePivotIn('role', ['owner', 'admin'])
            ->wherePivot('is_active', true)
            ->each(function ($user) use ($organization) {
                Mail::to($user->email)->queue(new PaymentsEnabledForOrgMail($organization));
            });

        return response()->json([
            'data' => [
                'organization_id'     => $organization->id,
                'org_payments_enabled' => true,
                'enabled_at'          => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * POST /api/v1/platform/organizations/{organization}/disable-payments
     * Auth: platform admin (admin_users only)
     */
    public function disablePayments(Request $request, Organization $organization): JsonResponse
    {
        $adminUser = $request->user();

        $flag = PaymentFeatureFlag::updateOrCreate(
            [
                'scope'           => 'organization',
                'organization_id' => $organization->id,
                'flag_key'        => 'org_payments_enabled',
            ],
            [
                'is_enabled'  => false,
                'enabled_at'  => null,
                'notes'       => 'Disabled by platform admin: '.$adminUser->email,
            ],
        );

        AuditLogService::record([
            'organization_id' => $organization->id,
            'entity_type'     => 'payment_feature_flag',
            'entity_id'       => $flag->id,
            'action'          => 'org_payments_disabled',
            'metadata'        => [
                'flag_key'       => 'org_payments_enabled',
                'platform_admin' => $adminUser->email,
            ],
        ]);

        return response()->json([
            'data' => [
                'organization_id'      => $organization->id,
                'org_payments_enabled' => false,
            ],
        ]);
    }
}
