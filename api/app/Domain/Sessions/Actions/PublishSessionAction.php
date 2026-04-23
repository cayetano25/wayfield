<?php

namespace App\Domain\Sessions\Actions;

use App\Domain\Sessions\Services\ValidateVirtualSessionPublishService;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\Session;
use App\Models\User;

class PublishSessionAction
{
    public function __construct(
        private readonly ValidateVirtualSessionPublishService $validator,
    ) {}

    /**
     * Publish a session.
     *
     * Dual-write during transition: sets both publication_status='published' AND
     * is_published=true. The DB trigger keeps them in sync for subsequent updates,
     * but the explicit dual-write ensures correctness regardless of trigger support.
     */
    public function execute(Session $session, ?User $actor = null): Session
    {
        if ($session->publication_status === 'published') {
            return $session;
        }

        $this->validator->validate($session);

        $session->update([
            'publication_status' => 'published',
            'is_published' => true,
        ]);

        AuditLogService::record([
            'organization_id' => $session->workshop?->organization_id,
            'actor_user_id' => $actor?->id,
            'entity_type' => 'session',
            'entity_id' => $session->id,
            'action' => 'session_published',
            'metadata' => [
                'session_title' => $session->title,
                'session_type' => $session->session_type,
                'participant_visibility' => $session->participant_visibility,
                'enrollment_mode' => $session->enrollment_mode,
            ],
        ]);

        return $session->fresh();
    }
}
