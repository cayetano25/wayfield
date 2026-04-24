<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Verification required — Wayfield</title>
</head>
<body style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2E2E2E; background: #F5F5F5; padding: 32px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px;">
        <h1 style="color: #E67E22; font-size: 24px; margin-bottom: 8px;">Stripe verification required</h1>
        <p>Stripe requires additional verification for <strong>{{ $orgName }}</strong> before payments can continue.</p>
        <p>The <strong>{{ $capabilityId }}</strong> capability has been paused. Please log into Stripe to complete the required steps.</p>
        <p style="margin-top: 32px;">
            <a href="{{ $dashboardUrl }}" style="background: #E67E22; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                Complete Verification
            </a>
        </p>
        <p style="margin-top: 32px; font-size: 12px; color: #888;">Wayfield · If you did not expect this email, please contact support.</p>
    </div>
</body>
</html>
