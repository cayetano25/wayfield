'use client';

import type { Metadata } from 'next';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MessageSquare, Plus, Clock, CheckCircle, AlertCircle, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getToken } from '@/lib/auth/session';
import { fetchMyTickets, submitTicket, markTicketRead, type SupportTicket } from '@/lib/api/support';
import Link from 'next/link';

/* --- Status badge --------------------------------------------------------- */

const STATUS_STYLES: Record<string, string> = {
  open:         'bg-blue-100 text-blue-700',
  in_progress:  'bg-amber-100 text-amber-700',
  pending_user: 'bg-amber-100 text-amber-700',
  resolved:     'bg-[#0FA3B1]/10 text-[#0FA3B1]',
  closed:       'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  open:         'Open',
  in_progress:  'In Progress',
  pending_user: 'Awaiting Your Response',
  resolved:     'Resolved',
  closed:       'Closed',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium font-mono uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

/* --- Ticket card ---------------------------------------------------------- */

function TicketCard({ ticket, isHighlighted }: { ticket: SupportTicket; isHighlighted: boolean }) {
  const [expanded, setExpanded] = useState(isHighlighted);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isHighlighted]);

  return (
    <div
      ref={cardRef}
      className={`rounded-xl border ${isHighlighted ? 'border-[#0FA3B1] shadow-md' : 'border-gray-200'} bg-white overflow-hidden`}
    >
      <button
        type="button"
        className="w-full text-left px-6 py-4 flex items-start justify-between gap-4"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{ticket.subject}</p>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={ticket.status} />
            <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
        <span className="text-xs text-gray-400 shrink-0 mt-1">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-6 py-4 space-y-3">
          {/* Admin reply card */}
          {ticket.latest_admin_reply && (
            <div className="rounded-lg border border-[#0FA3B1]/30 bg-[#0FA3B1]/5 p-4">
              <p className="text-xs font-mono uppercase tracking-wide text-[#0FA3B1] mb-2 font-semibold">
                From Wayfield Support:
              </p>
              <p className="text-sm text-gray-800 leading-relaxed">{ticket.latest_admin_reply.body}</p>
              <p className="text-xs text-gray-400 mt-2 font-mono">
                {formatDistanceToNow(new Date(ticket.latest_admin_reply.created_at), { addSuffix: true })}
              </p>
            </div>
          )}

          {/* Message thread */}
          <div className="space-y-2">
            {ticket.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
                    msg.sender_type === 'user'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-[#0FA3B1]/10 text-gray-800'
                  }`}
                >
                  <p className="leading-relaxed">{msg.body}</p>
                  <p className="text-[10px] text-gray-400 mt-1 font-mono">
                    {msg.sender_type === 'admin' ? 'Wayfield Support · ' : ''}
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* --- New ticket form ------------------------------------------------------ */

const CATEGORIES = [
  { value: '', label: 'Select a category…' },
  { value: 'billing',       label: 'Billing & Payments' },
  { value: 'technical',     label: 'Technical Issue' },
  { value: 'account',       label: 'Account & Access' },
  { value: 'workshops',     label: 'Workshops & Sessions' },
  { value: 'other',         label: 'Other' },
];

function NewTicketForm({ onSubmitted }: { onSubmitted: (ticket: SupportTicket) => void }) {
  const [subject, setSubject]   = useState('');
  const [category, setCategory] = useState('');
  const [body, setBody]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await submitTicket({ subject: subject.trim(), body: body.trim(), category: category || undefined });
      onSubmitted(ticket);
    } catch {
      setError('Failed to submit your ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900">Submit a Support Ticket</h3>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent"
          placeholder="Briefly describe your issue"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent resize-none"
          placeholder="Please describe your issue in detail…"
          required
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !subject.trim() || !body.trim()}
        className="w-full py-2.5 px-4 bg-[#0FA3B1] text-white text-sm font-semibold rounded-lg hover:bg-[#0c8a96] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Submitting…' : 'Submit Ticket'}
      </button>
    </form>
  );
}

/* --- Main page ------------------------------------------------------------ */

export default function HelpPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const highlightId = searchParams.get('ticket') ? Number(searchParams.get('ticket')) : null;

  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  // Check auth state on mount
  useEffect(() => {
    const token = getToken();
    setAuthenticated(!!token);
  }, []);

  // Fetch tickets when authenticated
  useEffect(() => {
    if (!authenticated) return;
    setLoading(true);
    fetchMyTickets()
      .then(setTickets)
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, [authenticated]);

  // Mark highlighted ticket as read
  useEffect(() => {
    if (highlightId && authenticated) {
      void markTicketRead(highlightId);
    }
  }, [highlightId, authenticated]);

  function handleTicketSubmitted(ticket: SupportTicket) {
    setTickets((prev) => [ticket, ...prev]);
    setShowForm(false);
    setConfirmation(`Ticket #${ticket.id} submitted. We'll be in touch soon.`);
  }

  if (authenticated === null) {
    return null; // Hydrating
  }

  if (!authenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <MessageSquare className="w-12 h-12 text-[#0FA3B1] mx-auto mb-4" />
          <h1 className="text-2xl font-bold font-heading text-gray-900 mb-3">Support</h1>
          <p className="text-gray-500 mb-6">Sign in to submit a support ticket or view your existing tickets.</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-[#0FA3B1] text-white text-sm font-semibold rounded-lg hover:bg-[#0c8a96] transition-colors"
          >
            Sign in to continue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">Support</h1>
          <p className="text-gray-500 text-sm mt-1">Submit tickets and view replies from our support team.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((p) => !p)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0FA3B1] text-white text-sm font-semibold rounded-lg hover:bg-[#0c8a96] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {/* Confirmation banner */}
      {confirmation && (
        <div className="flex items-center justify-between gap-3 mb-6 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-green-600" />
            {confirmation}
          </div>
          <button type="button" onClick={() => setConfirmation(null)} className="shrink-0 text-green-600 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* New ticket form */}
      {showForm && (
        <div className="mb-8">
          <NewTicketForm onSubmitted={handleTicketSubmitted} />
        </div>
      )}

      {/* Ticket list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 && !showForm ? (
        <div className="text-center py-16">
          <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No tickets yet</p>
          <p className="text-gray-400 text-xs mt-1">Click "New Ticket" to get in touch with support.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              isHighlighted={ticket.id === highlightId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
