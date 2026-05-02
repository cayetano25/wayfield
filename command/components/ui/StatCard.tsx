interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  alertLevel?: 'warning';
}

export function StatCard({ label, value, sub, alertLevel }: StatCardProps) {
  const containerClass =
    alertLevel === 'warning'
      ? 'bg-amber-50 border-amber-300'
      : 'bg-white border-gray-200';

  return (
    <div className={`rounded-xl border shadow-sm p-6 ${containerClass}`}>
      <p
        className="text-xs uppercase tracking-widest text-gray-400 mb-1"
        style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
      >
        {label}
      </p>
      <p className="font-heading text-3xl font-bold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
