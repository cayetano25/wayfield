<?php

namespace App\Domain\Payments\Services;

use App\Domain\Payments\DTOs\ReceiptBranding;
use App\Models\Organization;

/**
 * Resolves receipt branding based on the organization's active plan.
 *
 * Plan tiers and their branding entitlements:
 *   foundation → no org logo, Wayfield brand shown
 *   creator    → org logo shown, Wayfield brand shown
 *   studio     → org logo shown, custom primary_color, no Wayfield brand
 *   enterprise → org logo shown, custom primary_color, no Wayfield brand
 */
class ReceiptBrandingService
{
    private const WAYFIELD_TEAL = '#0FA3B1';

    public function getBranding(Organization $org): ReceiptBranding
    {
        $planCode = $org->subscription?->plan_code ?? 'foundation';

        return new ReceiptBranding(
            logoUrl:           $this->getLogoUrl($org, $planCode),
            orgName:           $org->name,
            orgEmail:          $org->primary_contact_email,
            orgPhone:          $org->primary_contact_phone,
            primaryColor:      $this->getPrimaryColor($org, $planCode),
            showWayfieldBrand: in_array($planCode, ['foundation', 'creator'], true),
            showOrgLogo:       in_array($planCode, ['creator', 'studio', 'enterprise'], true),
        );
    }

    private function getLogoUrl(Organization $org, string $planCode): ?string
    {
        if (! in_array($planCode, ['creator', 'studio', 'enterprise'], true)) {
            return null;
        }

        return $org->logo_url;
    }

    private function getPrimaryColor(Organization $org, string $planCode): string
    {
        if (in_array($planCode, ['studio', 'enterprise'], true) && $org->primary_color) {
            return $org->primary_color;
        }

        return self::WAYFIELD_TEAL;
    }
}
