import { NextResponse } from 'next/server';

interface ContactPayload {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

export async function POST(request: Request) {
  let body: ContactPayload;

  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  const { name, email, message } = body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json(
      { message: 'Name, email, and message are required.' },
      { status: 422 },
    );
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email.trim())) {
    return NextResponse.json({ message: 'Please provide a valid email address.' }, { status: 422 });
  }

  // TODO: wire to AWS SES / Resend / Postmark once email provider is configured.
  // For now, log to server stdout so submissions are visible in dev/staging logs.
  console.log('[contact-form]', {
    name: name.trim(),
    email: email.trim(),
    subject: body.subject ?? 'General Question',
    message: message.trim(),
    receivedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
