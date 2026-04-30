<?php

namespace App\Jobs;

use App\Domain\Payments\Models\EmailLog;
use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Services\ReceiptBrandingService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Re-sends a PDF receipt for a completed order.
 * Triggered by POST /api/v1/me/orders/{orderNumber}/resend-receipt.
 */
class SendReceiptEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(
        private readonly int $orderId,
        private readonly int $userId,
    ) {}

    public function handle(ReceiptBrandingService $brandingService): void
    {
        $order = Order::with([
            'user',
            'organization',
            'organization.subscription:id,organization_id,plan_code,status',
            'items.workshop',
            'items.session',
            'coupon',
            'refundRequests' => fn ($q) => $q->where('status', 'processed')
                ->with('refundTransactions'),
        ])->find($this->orderId);

        if (! $order || $order->user_id !== $this->userId) {
            Log::warning('SendReceiptEmailJob: order not found or user mismatch', [
                'order_id' => $this->orderId,
                'user_id'  => $this->userId,
            ]);

            return;
        }

        if (! $order->user) {
            return;
        }

        $branding = $brandingService->getBranding($order->organization);

        $pdf = Pdf::loadView('receipts.order-receipt', [
            'order'    => $order,
            'branding' => $branding,
            'user'     => $order->user,
            'items'    => $order->items,
            'refunds'  => $order->refundRequests,
        ])->setPaper('a4', 'portrait');

        $pdfContent = $pdf->output();
        $filename   = 'wayfield-receipt-' . $order->order_number . '.pdf';
        $subject    = "Your receipt for order {$order->order_number}";

        Mail::send(
            'emails.payments.receipt',
            ['order' => $order, 'user' => $order->user],
            function ($message) use ($order, $pdfContent, $filename, $subject) {
                $message
                    ->to(
                        $order->user->email,
                        $order->user->first_name . ' ' . $order->user->last_name
                    )
                    ->subject($subject)
                    ->attachData($pdfContent, $filename, ['mime' => 'application/pdf']);
            }
        );

        EmailLog::create([
            'notification_code'   => 'N-03',
            'recipient_user_id'   => $order->user_id,
            'recipient_email'     => $order->user->email,
            'subject'             => $subject,
            'template_name'       => 'receipts.order-receipt',
            'status'              => 'sent',
            'sent_at'             => now(),
            'related_entity_type' => 'order',
            'related_entity_id'   => $order->id,
        ]);
    }
}
