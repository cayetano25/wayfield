import type { ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
}

export function Table({ children }: TableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <table className="w-full text-left">{children}</table>
    </div>
  );
}

export function TableHead({ children }: TableProps) {
  return (
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({ children, className = '' }: TableProps & { className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${className}`}
      style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
    >
      {children}
    </th>
  );
}

export function TableBody({ children }: TableProps) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>;
}

export function Td({ children, className = '' }: TableProps & { className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
