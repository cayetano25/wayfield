<x-mail::message>
# Reset Your Password

Hello {{ $user->first_name }},

You are receiving this email because we received a password reset request for your account. Click the button below to reset your password.

<x-mail::button :url="$resetUrl" color="primary">
Reset Password
</x-mail::button>

This password reset link will expire in 60 minutes.

If you did not request a password reset, no further action is required. Your account remains secure.

Thanks,
The Wayfield Team
</x-mail::message>
