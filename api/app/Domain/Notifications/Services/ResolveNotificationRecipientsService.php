<?php

namespace App\Domain\Notifications\Services;

use App\Domain\Notifications\Exceptions\CustomDeliveryNotImplementedException;
use App\Models\Leader;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\NotificationRecipient;
use App\Models\Registration;
use App\Models\SessionSelection;
use App\Models\WorkshopLeader;
use Illuminate\Support\Collection;

class ResolveNotificationRecipientsService
{
    /**
     * Resolve recipient user IDs for a notification and create notification_recipient rows.
     *
     * IMPORTANT: notification_preferences MUST NOT suppress transactional emails.
     * Transactional emails (verification, password reset, leader invitation) are
     * dispatched directly via Mail::queue() and do NOT pass through this service.
     * Preferences here only affect workshop notification delivery channels.
     *
     * 'custom' delivery scope is reserved for future implementation.
     * See README.md Open Issues — no data model exists for this yet.
     */
    public function resolve(Notification $notification): Collection
    {
        $userIds = match ($notification->delivery_scope) {
            'all_participants' => $this->resolveAllParticipants($notification),
            'leaders' => $this->resolveLeaders($notification),
            'session_participants' => $this->resolveSessionParticipants($notification),
            'custom' => throw new CustomDeliveryNotImplementedException(
                // 'custom' delivery scope is reserved for future implementation
                // See README.md Open Issues — no data model exists for this yet
                'The custom delivery scope is not yet implemented.'
            ),
        };

        $recipients = collect();

        foreach ($userIds as $userId) {
            $prefs = $this->getPreferences($userId);

            $emailStatus = $this->resolveEmailStatus($notification, $prefs);
            $pushStatus = $this->resolvePushStatus($notification, $prefs);

            $recipient = NotificationRecipient::firstOrCreate(
                ['notification_id' => $notification->id, 'user_id' => $userId],
                [
                    'email_status' => $emailStatus,
                    'push_status' => $pushStatus,
                    'in_app_status' => 'pending',
                ]
            );

            $recipients->push($recipient);
        }

        return $recipients;
    }

    // ─── Scope resolvers ─────────────────────────────────────────────────────

    private function resolveAllParticipants(Notification $notification): array
    {
        return Registration::where('workshop_id', $notification->workshop_id)
            ->where('registration_status', 'registered')
            ->pluck('user_id')
            ->unique()
            ->values()
            ->all();
    }

    private function resolveLeaders(Notification $notification): array
    {
        // Resolve user IDs of leaders assigned to the workshop who have linked accounts
        return WorkshopLeader::where('workshop_id', $notification->workshop_id)
            ->where('is_confirmed', true)
            ->with('leader')
            ->get()
            ->pluck('leader.user_id')
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function resolveSessionParticipants(Notification $notification): array
    {
        if (! $notification->session_id) {
            return [];
        }

        $notification->loadMissing('workshop');

        if ($notification->workshop->workshop_type === 'session_based') {
            return SessionSelection::join('registrations', 'registrations.id', '=', 'session_selections.registration_id')
                ->where('session_selections.session_id', $notification->session_id)
                ->where('session_selections.selection_status', 'selected')
                ->where('registrations.registration_status', 'registered')
                ->pluck('registrations.user_id')
                ->unique()
                ->values()
                ->all();
        }

        // event_based: all registered participants for the workshop
        return Registration::where('workshop_id', $notification->workshop_id)
            ->where('registration_status', 'registered')
            ->pluck('user_id')
            ->unique()
            ->values()
            ->all();
    }

    // ─── Preference resolution ────────────────────────────────────────────────

    /**
     * Get a user's preferences, or fall back to defaults if no row exists.
     * We do NOT auto-create preferences rows here — defaults are sufficient.
     */
    private function getPreferences(int $userId): NotificationPreference
    {
        return NotificationPreference::firstOrNew(
            ['user_id' => $userId],
            [
                'email_enabled' => true,
                'push_enabled' => true,
                'workshop_updates_enabled' => true,
                'reminder_enabled' => true,
                'marketing_enabled' => false,
            ]
        );
    }

    /**
     * Determine email delivery status based on notification type and user preferences.
     *
     * Rules:
     * - urgent notifications always deliver (preferences cannot suppress them)
     * - if email_enabled = false → skip
     * - if notification_type = reminder and reminder_enabled = false → skip
     * - if notification_type = informational and workshop_updates_enabled = false → skip
     */
    private function resolveEmailStatus(Notification $notification, NotificationPreference $prefs): string
    {
        if ($notification->notification_type === 'urgent') {
            return 'pending';
        }

        if (! $prefs->email_enabled) {
            return 'skipped';
        }

        if ($notification->notification_type === 'reminder' && ! $prefs->reminder_enabled) {
            return 'skipped';
        }

        if ($notification->notification_type === 'informational' && ! $prefs->workshop_updates_enabled) {
            return 'skipped';
        }

        return 'pending';
    }

    /**
     * Determine push delivery status based on notification type and user preferences.
     *
     * Same suppression logic as email, but against push_enabled.
     */
    private function resolvePushStatus(Notification $notification, NotificationPreference $prefs): string
    {
        if ($notification->notification_type === 'urgent') {
            return 'pending';
        }

        if (! $prefs->push_enabled) {
            return 'skipped';
        }

        if ($notification->notification_type === 'reminder' && ! $prefs->reminder_enabled) {
            return 'skipped';
        }

        if ($notification->notification_type === 'informational' && ! $prefs->workshop_updates_enabled) {
            return 'skipped';
        }

        return 'pending';
    }
}
