<x-mail::message>
# New Contact Form Submission

**From:** {{ $senderName }} &lt;{{ $senderEmail }}&gt;
**Subject:** {{ str_replace('_', ' ', ucwords($subject, '_')) }}
**Submitted:** {{ $submittedAt }}
**IP Address:** {{ $ipAddress }}

---

{{ $body }}

</x-mail::message>
