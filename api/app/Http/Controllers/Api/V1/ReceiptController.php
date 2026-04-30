<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Services\ReceiptBrandingService;
use App\Http\Controllers\Controller;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ReceiptController extends Controller
{
    /**
     * GET /api/v1/me/orders/{orderNumber}/receipt
     * Downloads a PDF receipt for the authenticated user's own completed order.
     */
    public function download(
        Request $request,
        string $orderNumber,
        ReceiptBrandingService $brandingService,
    ): Response {
        $order = Order::where('order_number', $orderNumber)
            ->where('user_id', $request->user()->id)
            ->with([
                'user:id,first_name,last_name,email',
                'organization',
                'organization.subscription',
                'items.workshop:id,title,start_date,end_date,timezone',
                'items.session:id,title,start_at,end_at',
                'coupon:id,code,label,discount_type,discount_pct,discount_amount_cents',
                'refundRequests' => fn ($q) => $q->where('status', 'processed')
                    ->with('refundTransactions'),
            ])
            ->firstOrFail();

        if (! in_array($order->status, ['completed', 'partially_refunded', 'fully_refunded'], true)) {
            abort(422, 'Receipt is only available for completed orders.');
        }

        $branding = $brandingService->getBranding($order->organization);

        $pdf = Pdf::loadView('receipts.order-receipt', [
            'order'    => $order,
            'branding' => $branding,
            'user'     => $order->user,
            'items'    => $order->items,
            'refunds'  => $order->refundRequests,
        ])
        ->setPaper('a4', 'portrait')
        ->setOptions([
            'enable_remote' => true,
            'default_font'  => 'helvetica',
        ]);

        $filename = 'wayfield-receipt-' . $order->order_number . '.pdf';

        return $pdf->download($filename);
    }
}
