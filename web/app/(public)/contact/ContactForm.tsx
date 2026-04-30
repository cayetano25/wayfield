'use client';

import { useState } from 'react';

const SUBJECTS = [
  'General Question',
  'Organizer Inquiry',
  'Technical Support',
  'Partnership',
  'Press',
  'Other',
];

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export function ContactForm() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    subject: SUBJECTS[0],
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message ?? 'Something went wrong.');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        style={{
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: 12,
          padding: '32px 28px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h3 className="font-heading font-bold" style={{ fontSize: 20, color: '#2E2E2E', marginBottom: 8 }}>
          Message sent!
        </h3>
        <p className="font-sans" style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.65 }}>
          Thanks! We&apos;ll be in touch within 1–2 business days.
        </p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: 'var(--font-sans)',
    color: '#2E2E2E',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 6,
    fontFamily: 'var(--font-sans)',
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Name */}
        <div>
          <label htmlFor="contact-name" style={labelStyle}>
            Name <span style={{ color: '#E94F37' }}>*</span>
          </label>
          <input
            id="contact-name"
            type="text"
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Your full name"
            style={inputStyle}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="contact-email" style={labelStyle}>
            Email <span style={{ color: '#E94F37' }}>*</span>
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="contact-subject" style={labelStyle}>
            Subject
          </label>
          <select
            id="contact-subject"
            value={form.subject}
            onChange={(e) => update('subject', e.target.value)}
            style={{ ...inputStyle, background: 'white', cursor: 'pointer' }}
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Message */}
        <div>
          <label htmlFor="contact-message" style={labelStyle}>
            Message <span style={{ color: '#E94F37' }}>*</span>
          </label>
          <textarea
            id="contact-message"
            required
            rows={5}
            value={form.message}
            onChange={(e) => update('message', e.target.value)}
            placeholder="Tell us how we can help…"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Error */}
        {error && (
          <p
            className="font-sans"
            style={{
              fontSize: 14,
              color: '#E94F37',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              padding: '10px 14px',
            }}
          >
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !form.name.trim() || !form.email.trim() || !form.message.trim()}
          className="font-sans font-semibold transition-opacity"
          style={{
            background: '#0FA3B1',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '12px 24px',
            fontSize: 15,
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Sending…' : 'Send Message'}
        </button>
      </div>
    </form>
  );
}
