<x-mail::message>
# You're In!

Hello {{ $user->first_name }},

You have successfully joined **{{ $workshop->title }}**.

<x-mail::panel>
**Workshop Details**

Dates: {{ \Carbon\Carbon::parse($workshop->start_date)->format('M j, Y') }} – {{ \Carbon\Carbon::parse($workshop->end_date)->format('M j, Y') }}

Timezone: {{ $workshop->timezone }}
</x-mail::panel>

Log in to the Wayfield app to view the full schedule, select your sessions, and access logistics information.

If you have any questions, contact the workshop organizer.

Thanks,
The Wayfield Team
</x-mail::message>
