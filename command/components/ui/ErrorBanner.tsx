import { AlertTriangle } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <AlertTriangle size={16} className="text-red-500 shrink-0" />
      <span className="text-sm text-red-700 flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-medium text-red-700 hover:underline min-h-[44px] px-2"
        >
          Retry
        </button>
      )}
    </div>
  );
}
