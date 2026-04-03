'use client';

import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helper, className = '', id, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-dark">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`
              w-full h-10 pl-3 pr-10 text-sm text-dark bg-white
              border rounded-lg outline-none appearance-none transition-colors
              focus:ring-2 focus:ring-primary/20 focus:border-primary
              disabled:bg-surface disabled:text-medium-gray disabled:cursor-not-allowed
              ${error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border-gray'}
              ${className}
            `}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {!error && helper && <p className="text-xs text-medium-gray">{helper}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
