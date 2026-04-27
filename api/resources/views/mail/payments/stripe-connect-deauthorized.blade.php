<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Stripe account disconnected — Wayfield</title>
</head>
<body style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2E2E2E; background: #F5F5F5; padding: 32px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px;">
        <h1 style="color: #E94F37; font-size: 24px; margin-bottom: 8px;">Action required: Stripe account disconnected</h1>
        <p>The Stripe account for <strong>{{ $orgName }}</strong> has been disconnected from Wayfield.</p>
        <p>Payments cannot be processed until you reconnect your Stripe account. Your existing registrations and orders are unaffected.</p>
        <p style="margin-top: 32px;">
            <a href="{{ $reconnectUrl }}" style="background: #E94F37; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                Reconnect Stripe Account
            </a>
        </p>
        <p style="margin-top: 32px; font-size: 12px; color: #888;">Wayfield · If you did not expect this email, please contact support.</p>
    </div>
</body>
</html>
