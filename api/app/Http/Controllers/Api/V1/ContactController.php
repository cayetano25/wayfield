<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ContactFormRequest;
use App\Mail\ContactFormMail;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Mail;

class ContactController extends Controller
{
    public function submit(ContactFormRequest $request): JsonResponse
    {
        $data = $request->validated();

        Mail::to(config('wayfield.contact_email'))
            ->queue(new ContactFormMail(
                senderName: $data['name'],
                senderEmail: $data['email'],
                subject: $data['subject'],
                body: $data['message'],
                submittedAt: now()->toDateTimeString(),
                ipAddress: $request->ip() ?? 'unknown',
            ));

        return response()->json(['message' => 'Message received. We will be in touch soon.']);
    }
}
