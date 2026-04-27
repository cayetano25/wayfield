'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { DisputeBanner, type ActiveDispute } from '@/components/shared/DisputeBanner';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet } from '@/lib/api/client';
import {
  getOrgRefundRequests,
  approveRefundRequest,
  denyRefundRequest,
  issueCreditForRefundRequest,
  type RefundRequest,
  type RefundRequestStatus,
  REASON_CODES,
} from '@/lib/api/refunds';
import { formatCents } from '@/lib/utils/currency';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/* ─── Types ────────────────────────────────────────────────────────────── */

interface Workshop {
  id: number;
  title: string;
  organization_id: number;
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<
  RefundRequestStatus,
  { label: string; classes: string }
> = {
  pending:      { label: 'Pending',      classes: 'bg-amber-100 text-amber-700' },
  auto_approved:{ label: 'Auto-Approved',classes: 'bg-emerald-100 text-emerald-700' },
  approved:     { label: 'Approved',     classes: 'bg-emerald-100 text-emerald-700' },
  denied:       { label: 'Denied',       classes: 'bg-red-100 text-red-700' },
};

function reasonLabel(code: string): string {
  return REASON_CODES.find((r) => r.value === code)?.label ?? code;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* ─── Status badge ─────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: RefundRequestStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, classes: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

/* ─── Approve modal ────────────────────────────────────────────────────── */

function ApproveModal({
  refundRequest,
  onClose,
  onApproved,
}: {
  refundRequest: RefundRequest | null;
  onClose: () => void;
  onApproved: (id: number, amountCents: number) => void;
}) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (refundRequest) {
      setAmount((refundRequest.requested_amount_cents / 100).toFixed(2));
      setNotes('');
    }
  }, [refundRequest]);

  async function handleConfirm() {
    if (!refundRequest) return;
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents <= 0) {
      toast.error('Enter a valid refund amount.');
      return;
    }
    setSubmitting(true);
    try {
      await approveRefundRequest(refundRequest.id, {
        approved_amount_cents: cents,
        review_notes: notes || undefined,
      });
      toast.success('Refund approved and submitted to Stripe.');
      onApproved(refundRequest.id, cents);
      onClose();
    } catch {
      toast.error('Failed to approve refund. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const open = !!refundRequest;
  const requestedCents = refundRequest?.requested_amount_cents ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Approve Refund"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" loading={submitting} onClick={handleConfirm}>
            Approve Refund
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-medium-gray leading-relaxed">
          This will immediately charge back to the participant&apos;s original payment method.
        </p>

        <div>
          <label className="block text-xs font-medium text-medium-gray mb-1.5">
            Refund amount
            <span className="ml-1 font-normal text-light-gray">
              (requested: {formatCents(requestedCents)})
            </span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-medium-gray">$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-10 pl-7 pr-3 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-medium-gray mb-1.5">
            Notes <span className="font-normal text-light-gray">(optional, not shown to participant)</span>
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Approved per policy"
            className="w-full px-3 py-2 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-light-gray resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}

/* ─── Deny modal ───────────────────────────────────────────────────────── */

function DenyModal({
  refundRequest,
  onClose,
  onDenied,
}: {
  refundRequest: RefundRequest | null;
  onClose: () => void;
  onDenied: (id: number) => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (refundRequest) setReason('');
  }, [refundRequest]);

  async function handleConfirm() {
    if (!refundRequest) return;
    if (!reason.trim()) {
      toast.error('Please provide a reason for the denial.');
      return;
    }
    setSubmitting(true);
    try {
      await denyRefundRequest(refundRequest.id, { review_notes: reason.trim() });
      toast.success('Refund request denied.');
      onDenied(refundRequest.id);
      onClose();
    } catch {
      toast.error('Failed to deny refund request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={!!refundRequest}
      onClose={onClose}
      title="Deny Refund Request"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="danger" loading={submitting} onClick={handleConfirm}>
            Deny Request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-medium-gray leading-relaxed">
          This reason will be shared with the participant in their denial notification.
        </p>
        <div>
          <label className="block text-xs font-medium text-medium-gray mb-1.5">
            Reason for denial <span className="text-danger">*</span>
          </label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Outside the refund window per our policy."
            className="w-full px-3 py-2 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-light-gray resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}

/* ─── Issue credit modal ───────────────────────────────────────────────── */

function IssueCreditModal({
  refundRequest,
  onClose,
  onIssued,
}: {
  refundRequest: RefundRequest | null;
  onClose: () => void;
  onIssued: (id: number) => void;
}) {
  const [amount, setAmount] = useState('');
  const [expiryDays, setExpiryDays] = useState('365');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (refundRequest) {
      setAmount((refundRequest.requested_amount_cents / 100).toFixed(2));
      setExpiryDays('365');
    }
  }, [refundRequest]);

  async function handleConfirm() {
    if (!refundRequest) return;
    const cents = Math.round(parseFloat(amount) * 100);
    const days = parseInt(expiryDays, 10);
    if (isNaN(cents) || cents <= 0) {
      toast.error('Enter a valid credit amount.');
      return;
    }
    setSubmitting(true);
    try {
      await issueCreditForRefundRequest(refundRequest.id, {
        amount_cents: cents,
        expiry_days: days || 365,
      });
      toast.success('Store credit issued to participant.');
      onIssued(refundRequest.id);
      onClose();
    } catch {
      toast.error('Failed to issue store credit.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={!!refundRequest}
      onClose={onClose}
      title="Issue Store Credit"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" loading={submitting} onClick={handleConfirm}>
            Issue Credit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-medium-gray leading-relaxed">
          Credits can be applied toward future Wayfield workshop registrations.
        </p>
        <div>
          <label className="block text-xs font-medium text-medium-gray mb-1.5">Credit amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-medium-gray">$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-10 pl-7 pr-3 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-medium-gray mb-1.5">Expires in (days)</label>
          <input
            type="number"
            min="1"
            max="730"
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            className="w-full h-10 px-3 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <p className="text-xs text-light-gray mt-1">Default: 365 days</p>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Refund request card ─────────────────────────────────────────────── */

function RefundRequestCard({
  req,
  canManage,
  onApprove,
  onDeny,
  onIssueCredit,
}: {
  req: RefundRequest;
  canManage: boolean;
  onApprove: (req: RefundRequest) => void;
  onDeny: (req: RefundRequest) => void;
  onIssueCredit: (req: RefundRequest) => void;
}) {
  const isPending = req.status === 'pending';
  const age = daysSince(req.created_at);
  const participantName = req.requested_by
    ? `${req.requested_by.first_name} ${req.requested_by.last_name}`
    : `User #${req.requested_by_user_id}`;
  const participantEmail = req.requested_by?.email ?? '';
  const displayAmount = req.approved_amount_cents ?? req.requested_amount_cents;

  return (
    <div className="bg-white rounded-xl border border-border-gray overflow-hidden">
      <div className="px-5 py-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-dark text-sm">{participantName}</p>
              {participantEmail && (
                <p className="text-xs text-medium-gray">{participantEmail}</p>
              )}
            </div>
            {req.order && (
              <p className="text-xs text-medium-gray mt-0.5">
                Order {req.order.order_number}
                {req.order.workshop_title && (
                  <span> · {req.order.workshop_title}</span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={req.status} />
            {isPending && age > 0 && (
              <span className={`text-xs font-medium ${age >= 3 ? 'text-red-600' : 'text-amber-600'}`}>
                {age}d ago
              </span>
            )}
          </div>
        </div>

        {/* Amount + reason */}
        <div className="flex items-center gap-4 mb-3">
          <div>
            <p className="text-xs text-medium-gray uppercase tracking-wide font-medium">Amount</p>
            <p className="text-lg font-bold text-dark">{formatCents(displayAmount)}</p>
            {req.approved_amount_cents !== null &&
              req.approved_amount_cents !== req.requested_amount_cents && (
                <p className="text-xs text-light-gray">
                  Requested: {formatCents(req.requested_amount_cents)}
                </p>
              )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-medium-gray uppercase tracking-wide font-medium">Reason</p>
            <p className="text-sm text-dark">{reasonLabel(req.reason_code)}</p>
            {req.reason_text && (
              <p className="text-xs text-medium-gray mt-0.5 line-clamp-2">{req.reason_text}</p>
            )}
          </div>
        </div>

        {/* Review notes */}
        {!isPending && req.review_notes && (
          <div className="bg-surface rounded-lg px-3 py-2 mb-3">
            <p className="text-xs text-medium-gray">
              <span className="font-medium">Review note:</span> {req.review_notes}
            </p>
          </div>
        )}

        {/* Date */}
        <p className="text-xs text-light-gray mb-4">
          Submitted {formatDate(req.created_at)}
          {req.reviewed_at && (
            <span> · Reviewed {formatDate(req.reviewed_at)}</span>
          )}
        </p>

        {/* Actions for pending */}
        {isPending && canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="primary" size="sm" onClick={() => onApprove(req)}>
              <CheckCircle className="w-3.5 h-3.5" />
              Approve {formatCents(req.requested_amount_cents)}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border-danger/30 text-danger hover:bg-danger/5"
              onClick={() => onDeny(req)}
            >
              <XCircle className="w-3.5 h-3.5" />
              Deny
            </Button>
            <button
              type="button"
              onClick={() => onIssueCredit(req)}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors px-2"
            >
              Issue Store Credit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Status filter tabs ───────────────────────────────────────────────── */

const FILTER_TABS = [
  { label: 'All',      value: '' },
  { label: 'Pending',  value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Denied',   value: 'denied' },
] as const;

/* ─── Main page ────────────────────────────────────────────────────────── */

export default function WorkshopOrdersPage() {
  const { id } = useParams<{ id: string }>();
  const { setPage } = usePage();
  const { currentOrg } = useUser();

  const canManage = currentOrg?.role === 'owner' || currentOrg?.role === 'admin';

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPageNum] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  // Disputes: populated once GET /organizations/{org}/disputes endpoint is available
  const [disputes] = useState<ActiveDispute[]>([]);

  const [approveTarget, setApproveTarget] = useState<RefundRequest | null>(null);
  const [denyTarget, setDenyTarget] = useState<RefundRequest | null>(null);
  const [creditTarget, setCreditTarget] = useState<RefundRequest | null>(null);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [ws, res] = await Promise.all([
        workshop ? Promise.resolve(workshop) : apiGet<Workshop>(`/workshops/${id}`),
        getOrgRefundRequests(currentOrg.id, {
          status: statusFilter || undefined,
          page,
        }),
      ]);
      setWorkshop(ws as Workshop);
      setRequests(res.data);
      setLastPage(res.meta.last_page);
    } catch {
      toast.error('Failed to load refund requests.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg, id, statusFilter, page, workshop]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const title = workshop?.title ?? 'Workshop';
    setPage(title, [
      { label: 'Workshops', href: '/workshops' },
      { label: title, href: `/workshops/${id}` },
      { label: 'Orders' },
    ]);
  }, [workshop, id, setPage]);

  function handleFilterChange(value: string) {
    setStatusFilter(value);
    setPageNum(1);
  }

  function handleApproved(reqId: number, amountCents: number) {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? { ...r, status: 'approved' as const, approved_amount_cents: amountCents }
          : r,
      ),
    );
  }

  function handleDenied(reqId: number) {
    setRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: 'denied' as const } : r)),
    );
  }

  function handleCreditIssued(reqId: number) {
    setRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: 'approved' as const } : r)),
    );
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  if (loading && requests.length === 0) {
    return (
      <div className="max-w-[900px] mx-auto space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 bg-white rounded-xl border border-border-gray animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="max-w-[900px] mx-auto">
        {/* Dispute banners */}
        <DisputeBanner disputes={disputes} />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-heading text-xl font-semibold text-dark">Refund Requests</h2>
            {pendingCount > 0 && (
              <p className="text-sm text-amber-600 mt-0.5">
                {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'} awaiting review
              </p>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 mb-5 bg-surface rounded-lg p-1 w-fit">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleFilterChange(tab.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-white text-dark shadow-sm'
                  : 'text-medium-gray hover:text-dark'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        {requests.length === 0 ? (
          <Card className="py-20 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-surface border border-border-gray flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-light-gray" />
            </div>
            <p className="font-heading font-semibold text-dark mb-1">No refund requests</p>
            <p className="text-sm text-medium-gray">
              {statusFilter ? `No ${statusFilter} refund requests.` : 'No refund requests have been submitted yet.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <RefundRequestCard
                key={req.id}
                req={req}
                canManage={canManage}
                onApprove={setApproveTarget}
                onDeny={setDenyTarget}
                onIssueCredit={setCreditTarget}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPageNum((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-medium-gray">
              Page {page} of {lastPage}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => setPageNum((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}

      </div>

      <ApproveModal
        refundRequest={approveTarget}
        onClose={() => setApproveTarget(null)}
        onApproved={handleApproved}
      />
      <DenyModal
        refundRequest={denyTarget}
        onClose={() => setDenyTarget(null)}
        onDenied={handleDenied}
      />
      <IssueCreditModal
        refundRequest={creditTarget}
        onClose={() => setCreditTarget(null)}
        onIssued={handleCreditIssued}
      />
    </>
  );
}
