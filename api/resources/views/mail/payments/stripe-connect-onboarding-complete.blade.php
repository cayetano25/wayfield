<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Payments enabled — Wayfield</title>
</head>
<body style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2E2E2E; background: #F5F5F5; padding: 32px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px;">
        <h1 style="color: #0FA3B1; font-size: 24px; margin-bottom: 8px;">Payments are now enabled</h1>
        <p>Your Stripe account for <strong>{{ $orgName }}</strong> has been verified and payments are now active.</p>
        <p>You can start accepting registrations with payment through your workshops.</p>
        <p style="margin-top: 32px;">
            <a href="{{ $dashboardUrl }}" style="background: #0FA3B1; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                Go to Payments Settings
            </a>
        </p>
        <p style="margin-top: 32px; font-size: 12px; color: #888;">Wayfield · If you did not expect this email, please contact support.</p>
    </div>
</body>
</html>
