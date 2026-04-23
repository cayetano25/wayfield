<?php

namespace App\Domain\Sessions\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\Session;
use App\Models\User;

class UpdateSessionAction
{
    /**
     * Fields that generate an audit log entry when changed.
     * These are access-control sensitive: changing them silently could lock out
     * participants or unexpectedly expose restricted sessions.
     */
    private const AUDITED_FIELDS = [
        'session_type',
        'participant_visibility',
        'enrollment_mode',
        'requires_separate_entitlement',
        'selection_opens_at',
        'selection_closes_at',
        'publication_status',
    ];

    public function execute(Session $session, array $data, ?User $actor = null): Session
    {
        $allowed = [
            // Core session fields
            'track_id', 'title', 'description', 'start_at', 'end_at',
            'capacity', 'delivery_type', 'virtual_participation_allowed',
            'meeting_platform', 'meeting_url', 'meeting_instructions',
            'meeting_id', 'meeting_passcode', 'notes', 'is_published',
            // Access-control fields (addon sessions feature)
            'session_type', 'publication_status', 'participant_visibility',
            'enrollment_mode', 'requires_separate_entitlement',
            'selection_opens_at', 'selection_closes_at',
        ];

        $filtered = array_intersect_key($data, array_flip($allowed));

        // Capture before-state for audited fields before the update.
        $changes = $this->detectAuditedChanges($session, $filtered);

        $session->fill($filtered);
        $session->save();

        // When publication_status changes, dual-write is_published for transition compat.
        if (array_key_exists('publication_status', $filtered)) {
            $session->is_published = $filtered['publication_status'] === 'published';
            $session->saveQuietly();
        }

        // Write one audit entry per changed access-control field.
        foreach ($changes as $field => $change) {
            AuditLogService::record([
                'organization_id' => $session->workshop?->organization_id,
                'actor_user_id' => $actor?->id,
                'entity_type' => 'session',
                'entity_id' => $session->id,
                'action' => "session_{$field}_changed",
                'metadata' => [
                    'field' => $field,
                    'from' => $change['from'],
                    'to' => $change['to'],
                    'session_title' => $session->title,
                ],
            ]);
        }

        return $session->fresh();
    }

    /**
     * @return array<string, array{from: mixed, to: mixed}>
     */
    private function detectAuditedChanges(Session $session, array $data): array
    {
        $changes = [];

        foreach (self::AUDITED_FIELDS as $field) {
            if (! array_key_exists($field, $data)) {
                continue;
            }

            $oldValue = $session->getAttribute($field);
            $newValue = $data[$field];

            // Normalize datetimes and booleans for comparison.
            $oldStr = $oldValue instanceof \Illuminate\Support\Carbon
                ? $oldValue->toIso8601String()
                : $oldValue;
            $newStr = $newValue instanceof \Illuminate\Support\Carbon
                ? $newValue->toIso8601String()
                : $newValue;

            if ($oldStr !== $newStr) {
                $changes[$field] = ['from' => $oldStr, 'to' => $newStr];
            }
        }

        return $changes;
    }
}
