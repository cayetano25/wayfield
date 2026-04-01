<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Leader Invitation — Wayfield</title>
</head>
<body style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2E2E2E; background: #F5F5F5; padding: 32px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px;">
        <h1 style="color: #0FA3B1; font-size: 24px; margin-bottom: 8px;">You've been invited!</h1>

        @if ($firstName)
            <p>Hi {{ $firstName }},</p>
        @else
            <p>Hi there,</p>
        @endif

        <p><strong>{{ $orgName }}</strong> has invited you to lead a workshop on Wayfield.</p>

        @if ($invitation->workshop_id)
            <p>This invitation is associated with a specific upcoming workshop.</p>
        @endif

        <p>Click the button below to accept this invitation, complete your leader profile, and get started.</p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="{{ $acceptUrl }}"
               style="background: #0FA3B1; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                Accept Invitation
            </a>
        </div>

        <p>If you'd prefer not to participate, you can
            <a href="{{ $declineUrl }}" style="color: #E94F37;">decline the invitation here</a>.
        </p>

        <p style="color: #888; font-size: 13px; margin-top: 32px;">
            This invitation link expires on {{ $invitation->expires_at->format('F j, Y') }}.
            If you did not expect this email, you can safely ignore it.
        </p>
    </div>
</body>
</html>
