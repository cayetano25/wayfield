<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformSupportController extends Controller
{
    /**
     * GET /api/v1/platform/support/tickets
     * List all support tickets across organizations.
     * Accessible by: super_admin, support, ops
     */
    public function index(Request $request): JsonResponse
    {
        $tickets = SupportTicket::query()
            ->with(['organization', 'submittedByUser', 'assignedToUser'])
            ->when($request->input('status'), fn ($q, $status) => $q->where('status', $status)
            )
            ->when($request->input('organization_id'), fn ($q, $orgId) => $q->where('organization_id', $orgId)
            )
            ->when($request->input('assigned_to'), fn ($q, $userId) => $q->where('assigned_to_user_id', $userId)
            )
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 25));

        return response()->json($tickets);
    }

    /**
     * GET /api/v1/platform/support/tickets/{ticket}
     * Full ticket detail with message thread.
     */
    public function show(SupportTicket $ticket): JsonResponse
    {
        $ticket->load(['organization', 'submittedByUser', 'assignedToUser', 'messages.senderUser']);

        return response()->json($ticket);
    }

    /**
     * PATCH /api/v1/platform/support/tickets/{ticket}
     * Update ticket status or assignment.
     */
    public function update(Request $request, SupportTicket $ticket): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['sometimes', 'string', 'in:open,in_progress,resolved,closed'],
            'assigned_to_user_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'priority' => ['sometimes', 'string', 'in:low,normal,high,urgent'],
        ]);

        $ticket->update($validated);

        return response()->json($ticket->fresh(['organization', 'submittedByUser', 'assignedToUser']));
    }

    /**
     * POST /api/v1/platform/support/tickets/{ticket}/messages
     * Add a message to a support ticket (platform agent reply).
     */
    public function addMessage(Request $request, SupportTicket $ticket): JsonResponse
    {
        $validated = $request->validate([
            'body' => ['required', 'string'],
            'is_internal' => ['sometimes', 'boolean'],
        ]);

        $message = $ticket->messages()->create([
            'sender_user_id' => $request->user()->id,
            'body' => $validated['body'],
            'is_internal' => $validated['is_internal'] ?? false,
        ]);

        return response()->json($message->load('senderUser'), 201);
    }
}
