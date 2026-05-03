<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Models\SupportTicketRead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantSupportController extends Controller
{
    /**
     * GET /api/v1/me/support/tickets
     *
     * Returns the authenticated user's own support tickets with public messages.
     * Internal messages (is_internal = true) are excluded — those are agent-only notes.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $tickets = SupportTicket::where('submitted_by_user_id', $userId)
            ->with([
                'messages' => fn ($q) => $q
                    ->where('is_internal', false)
                    ->orderBy('created_at'),
            ])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn (SupportTicket $t) => $this->formatTicket($t));

        return response()->json(['data' => $tickets]);
    }

    /**
     * POST /api/v1/me/support/tickets
     *
     * Submit a new support ticket. Creates the ticket and the initial message in one step.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'subject'  => ['required', 'string', 'max:500'],
            'body'     => ['required', 'string'],
            'category' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        $ticket = SupportTicket::create([
            'submitted_by_user_id' => $request->user()->id,
            'subject'              => $validated['subject'],
            'body'                 => $validated['body'],
            'category'             => $validated['category'] ?? null,
            'source'               => 'web',
            'status'               => 'open',
        ]);

        $ticket->messages()->create([
            'sender_user_id' => $request->user()->id,
            'body'           => $validated['body'],
            'is_internal'    => false,
        ]);

        return response()->json(
            ['data' => $this->formatTicket($ticket->load('messages'))],
            201,
        );
    }

    /**
     * POST /api/v1/notifications/support-tickets/{ticket}/mark-read
     *
     * Records that the user has read the latest admin reply on this ticket.
     * Idempotent. Suppresses the notification bell indicator for this ticket.
     */
    public function markRead(Request $request, int $ticketId): JsonResponse
    {
        $ticket = SupportTicket::where('id', $ticketId)
            ->where('submitted_by_user_id', $request->user()->id)
            ->firstOrFail();

        SupportTicketRead::upsert(
            [
                'ticket_id' => $ticket->id,
                'user_id'   => $request->user()->id,
                'read_at'   => now(),
            ],
            ['ticket_id', 'user_id'],
            ['read_at'],
        );

        return response()->json(['marked_read' => true]);
    }

    private function formatTicket(SupportTicket $ticket): array
    {
        // Admin replies: messages where sender_user_id IS NULL and not internal
        $latestAdminReply = $ticket->messages
            ->filter(fn (SupportTicketMessage $m) => $m->sender_user_id === null && ! $m->is_internal)
            ->sortByDesc('created_at')
            ->first();

        return [
            'id'                 => $ticket->id,
            'subject'            => $ticket->subject,
            'status'             => $ticket->status,
            'priority'           => $ticket->priority,
            'category'           => $ticket->category,
            'created_at'         => $ticket->created_at->toIso8601String(),
            'closed_at'          => $ticket->closed_at?->toIso8601String(),
            'latest_admin_reply' => $latestAdminReply ? [
                'body'       => $latestAdminReply->body,
                'created_at' => $latestAdminReply->created_at->toIso8601String(),
            ] : null,
            'messages' => $ticket->messages->map(fn (SupportTicketMessage $m) => [
                'id'          => $m->id,
                'body'        => $m->body,
                'sender_type' => $m->sender_user_id === null ? 'admin' : 'user',
                'created_at'  => $m->created_at->toIso8601String(),
            ])->values(),
        ];
    }
}
