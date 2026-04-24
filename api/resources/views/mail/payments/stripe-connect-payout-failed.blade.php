<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Payout failed — Wayfield</title>
</head>
<body style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2E2E2E; background: #F5F5F5; padding: 32px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px;">
        <h1 style="color: #E94F37; font-size: 24px; margin-bottom: 8px;">Payout failed</h1>
        <p>A payout for <strong>{{ $orgName }}</strong> could not be processed.</p>
        @if ($amountCents && $currency)
            <p><strong>Amount:</strong> {{ number_format($amountCents / 100, 2) }} {{ strtoupper($currency) }}</p>
        @endif
        <p><strong>Reason:</strong> {{ $failureMessage }}</p>
        <p>Please check your Stripe dashboard to resolve any bank account issues.</p>
        <p style="margin-top: 32px;">
            <a href="{{ $dashboardUrl }}" style="background: #0FA3B1; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                Go to Payments Settings
            </a>
        </p>
        <p style="margin-top: 32px; font-size: 12px; color: #888;">Wayfield · If you did not expect this email, please contact support.</p>
    </div>
</body>
</html>
