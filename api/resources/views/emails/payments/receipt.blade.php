<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Helvetica, Arial, sans-serif; font-size: 15px; color: #2E2E2E; line-height: 1.6; }
        .container { max-width: 600px; margin: 40px auto; padding: 0 20px; }
        .footer { margin-top: 32px; font-size: 12px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 16px; }
    </style>
</head>
<body>
<div class="container">
    <p>Hi {{ $user->first_name }},</p>

    <p>
        Your receipt for order <strong>{{ $order->order_number }}</strong> is attached
        as a PDF. Keep it for your records.
    </p>

    <p>
        If you have any questions about your order, please contact the organizer directly.
    </p>

    <div class="footer">
        Powered by Wayfield · This email was sent to {{ $user->email }}
    </div>
</div>
</body>
</html>
