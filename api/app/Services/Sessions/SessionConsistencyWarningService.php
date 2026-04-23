<?php

namespace App\Services\Sessions;

/**
 * Detects non-blocking configuration warnings for session access-control fields.
 *
 * Warnings are included in API response bodies but never block the operation.
 * They alert organizers to combinations that are technically valid but likely
 * unintentional — for example, marking a session as organizer-assign-only while
 * keeping it visible to participants creates a confusing UX.
 */
class SessionConsistencyWarningService
{
    public const WARN_VISIBILITY_ENROLLMENT_MISMATCH = 'WARN_VISIBILITY_ENROLLMENT_MISMATCH';

    public const WARN_ADDON_FULLY_PUBLIC = 'WARN_ADDON_FULLY_PUBLIC';

    /**
     * @param array<string, mixed> $data  Validated request data (may be partial PATCH)
     * @return array<int, array{code: string, message: string}>
     */
    public function detect(array $data): array
    {
        $warnings = [];

        $enrollmentMode = $data['enrollment_mode'] ?? null;
        $visibility = $data['participant_visibility'] ?? null;
        $sessionType = $data['session_type'] ?? null;

        // organizer_assign_only sessions should not be visible to participants —
        // they can see it but cannot select it, which is confusing.
        if ($enrollmentMode === 'organizer_assign_only' && $visibility === 'visible') {
            $warnings[] = [
                'code' => self::WARN_VISIBILITY_ENROLLMENT_MISMATCH,
                'message' => 'Session is organizer-assign-only but visible to participants. '
                    . 'Consider setting participant_visibility to hidden or invite_only.',
            ];
        }

        // An add-on session that is fully public (visible + self-select) behaves like
        // a standard session. This may be intentional but is worth surfacing.
        if ($sessionType === 'addon' && $visibility === 'visible' && $enrollmentMode === 'self_select') {
            $warnings[] = [
                'code' => self::WARN_ADDON_FULLY_PUBLIC,
                'message' => 'Add-on session is fully public and self-selectable, '
                    . 'which is the same behaviour as a standard session.',
            ];
        }

        return $warnings;
    }
}
