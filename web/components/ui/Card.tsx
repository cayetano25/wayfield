interface CardProps {
  children: React.ReactNode;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, interactive = false, className = '', onClick }: CardProps) {
  const base =
    'bg-white rounded-xl border border-border-gray shadow-[0px_12px_32px_rgba(46,46,46,0.06)]';
  const interactiveClass = interactive
    ? 'cursor-pointer transition-shadow hover:shadow-[0px_16px_40px_rgba(46,46,46,0.10)] hover:-translate-y-0.5'
    : '';

  if (interactive && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left ${base} ${interactiveClass} ${className}`}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={`${base} ${interactiveClass} ${className}`}>
      {children}
    </div>
  );
}
