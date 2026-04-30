<?php

namespace App\Domain\Payments\Services;

use App\Domain\Payments\DTOs\BulkGenerationResult;
use App\Domain\Payments\Models\Coupon;
use App\Models\Organization;
use App\Models\User;

class BulkCouponGenerationService
{
    public function generate(
        Organization $org,
        User $createdBy,
        array $validated
    ): BulkGenerationResult {
        $generated   = [];
        $attempts    = 0;
        $maxAttempts = $validated['count'] * 3;
        $prefix      = isset($validated['prefix']) ? strtoupper(trim($validated['prefix'])) : null;

        while (count($generated) < $validated['count'] && $attempts < $maxAttempts) {
            $code = $this->generateUniqueCode($prefix, $org->id);
            if ($code !== null) {
                $generated[] = $code;
            }
            $attempts++;
        }

        $failed = $validated['count'] - count($generated);

        if (empty($generated)) {
            return new BulkGenerationResult(
                count: 0,
                codes: [],
                coupon_ids: [],
                label: $validated['label'],
                failed: $failed,
            );
        }

        $now  = now();
        $rows = collect($generated)->map(fn ($code) => [
            'organization_id'            => $org->id,
            'workshop_id'                => $validated['workshop_id'] ?? null,
            'created_by_user_id'         => $createdBy->id,
            'code'                       => $code,
            'label'                      => $validated['label'],
            'description'                => "Bulk generated — {$validated['count']} codes",
            'discount_type'              => $validated['discount_type'],
            'discount_pct'               => $validated['discount_pct'] ?? null,
            'discount_amount_cents'      => $validated['discount_amount_cents'] ?? null,
            'applies_to'                 => $validated['applies_to'] ?? 'all',
            'minimum_order_cents'        => $validated['minimum_order_cents'] ?? 0,
            'max_redemptions'            => 1,
            'max_redemptions_per_user'   => $validated['max_redemptions_per_user'] ?? 1,
            'is_active'                  => $validated['is_active'] ?? true,
            'valid_from'                 => $validated['valid_from'] ?? null,
            'valid_until'                => $validated['valid_until'] ?? null,
            'redemption_count'           => 0,
            'total_discount_given_cents' => 0,
            'created_at'                 => $now,
            'updated_at'                 => $now,
        ])->toArray();

        Coupon::insert($rows);

        $inserted = Coupon::where('organization_id', $org->id)
            ->whereIn('code', $generated)
            ->get(['id', 'code']);

        return new BulkGenerationResult(
            count: count($generated),
            codes: $generated,
            coupon_ids: $inserted->pluck('id')->toArray(),
            label: $validated['label'],
            failed: $failed,
        );
    }

    private function generateUniqueCode(?string $prefix, int $orgId): ?string
    {
        for ($i = 0; $i < 5; $i++) {
            $random = strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
            $code   = $prefix ? "{$prefix}-{$random}" : $random;

            $exists = Coupon::where('organization_id', $orgId)
                ->where('code', $code)
                ->exists();

            if (! $exists) {
                return $code;
            }
        }

        return null;
    }
}
