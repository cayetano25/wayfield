<?php

namespace App\Domain\Sessions\Actions;

use App\Domain\Sessions\Services\ValidateVirtualSessionPublishService;
use App\Models\Session;

class PublishSessionAction
{
    public function __construct(
        private readonly ValidateVirtualSessionPublishService $validator,
    ) {}

    public function execute(Session $session): Session
    {
        if ($session->is_published) {
            return $session;
        }

        $this->validator->validate($session);

        $session->update(['is_published' => true]);

        return $session->fresh();
    }
}
