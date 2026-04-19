<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>You've been invited to join {{ $orgName }} — Wayfield</title>
</head>
<body style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2E2E2E; background: #F5F5F5; padding: 32px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px;">
        <h1 style="color: #0FA3B1; font-size: 24px; margin-bottom: 8px;">You've been invited!</h1>

        @if ($firstName)
            <p>Hi {{ $firstName }},</p>
        @else
            <p>Hi there,</p>
        @endif

        <p>
            <strong>{{ $inviterName }}</strong> has invited you to join
            <strong>{{ $orgName }}</strong> on Wayfield as
            <strong>{{ $roleDisplay }}</strong>.
        </p>

        @if (count($bullets) > 0)
            <p>As a <strong>{{ $roleDisplay }}</strong>, you'll be able to:</p>
            <ul style="line-height: 1.8;">
                @foreach ($bullets as $bullet)
                    <li>{{ $bullet }}</li>
                @endforeach
            </ul>
        @endif

        <div style="text-align: center; margin: 32px 0;">
            <a href="{{ $acceptUrl }}"
               style="background: #0FA3B1; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                Accept Invitation
            </a>
        </div>

        <p>
            If you'd prefer not to join, you can
            <a href="{{ $declineUrl }}" style="color: #E94F37;">decline the invitation here</a>.
        </p>

        <p style="color: #888; font-size: 13px; margin-top: 16px;">
            This invitation expires on {{ $invitation->expires_at->format('F j, Y') }}.
        </p>

        <p style="color: #888; font-size: 13px;">
            If you don't have a Wayfield account yet, you'll be prompted to create one
            after clicking Accept.
        </p>

        <p style="color: #aaa; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
            If you did not expect this email, you can safely ignore it.
            — The Wayfield Team
        </p>
    </div>
</body>
</html>
