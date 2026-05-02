import type { ReactNode } from 'react';

interface ConfirmModalProps {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmClass = destructive
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    : 'bg-[#0FA3B1] hover:bg-[#0d8f9c] focus:ring-[#0FA3B1]';

  return (
    // No backdrop-click handler — this is a deliberate destructive-action safeguard
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="font-heading text-lg font-semibold text-gray-900 mb-2">{title}</h2>
        <div className="text-sm text-gray-600 mb-6">{body}</div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`min-h-[44px] px-4 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors ${confirmClass}`}
          >
            {loading ? 'Loading…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
