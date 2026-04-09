export function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  const pct = Math.round(rate * 100 * 10) / 10;
  return `${pct}%`;
}

export function formatRateWithColor(rate: number | null): { value: string; color: string } {
  if (rate === null) return { value: '—', color: '#9CA3AF' };
  if (rate >= 0.8) return { value: formatRate(rate), color: '#10B981' };
  if (rate >= 0.5) return { value: formatRate(rate), color: '#F59E0B' };
  return { value: formatRate(rate), color: '#E94F37' };
}

export function formatNoShowRateWithColor(rate: number | null): { value: string; color: string } {
  if (rate === null) return { value: '—', color: '#9CA3AF' };
  if (rate <= 0.1) return { value: formatRate(rate), color: '#10B981' };
  if (rate <= 0.25) return { value: formatRate(rate), color: '#F59E0B' };
  return { value: formatRate(rate), color: '#E94F37' };
}

export function formatCapacityUtilization(util: number | null): string {
  if (util === null) return 'All sessions unlimited';
  const pct = Math.round(util * 100 * 10) / 10;
  return `${pct}%`;
}

export function formatWeekLabel(weekStart: string): string {
  // Parse 'YYYY-MM-DD' without timezone shifts
  const [year, month, day] = weekStart.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleString('default', { month: 'short', day: 'numeric' });
}
