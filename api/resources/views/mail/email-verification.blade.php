<x-mail::message>
# Verify Your Email Address

Hello {{ $user->first_name }},

Thank you for creating your Wayfield account. Please click the button below to verify your email address and activate your account.

<x-mail::button :url="$verifyUrl" color="primary">
Verify Email Address
</x-mail::button>

This verification link will expire in 60 minutes.

If you did not create a Wayfield account, no further action is required.

Thanks,
The Wayfield Team
</x-mail::message>
