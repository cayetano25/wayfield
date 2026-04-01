<x-mail::message>
# {{ $notification->title }}

Hello {{ $recipient->first_name }},

{{ $notification->message }}

<x-mail::panel>
**Workshop:** {{ $workshop->title }}
</x-mail::panel>

Log in to the Wayfield app for full details.

Thanks,
The Wayfield Team
</x-mail::message>
