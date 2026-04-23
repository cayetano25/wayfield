'use client';

interface SessionDatePickerProps {
  value: string | null;
  onChange: (date: string) => void;
  label: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  id?: string;
}

export function SessionDatePicker({
  value,
  onChange,
  label,
  minDate,
  maxDate,
  disabled = false,
  error,
  required = false,
  id,
}: SessionDatePickerProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-dark">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
      </label>
      <input
        type="date"
        id={inputId}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        min={minDate}
        max={maxDate}
        disabled={disabled}
        required={required}
        aria-label={label}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        className={[
          'w-full h-10 px-3 text-sm text-dark bg-white',
          'border rounded-lg outline-none transition-colors',
          'focus:ring-2 focus:ring-primary/20 focus:border-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface',
          error
            ? 'border-danger focus:border-danger focus:ring-danger/20'
            : 'border-border-gray',
        ].join(' ')}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
