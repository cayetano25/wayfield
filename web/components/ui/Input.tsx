'use client';

import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, rightElement, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-dark">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full h-10 px-3 text-sm text-dark bg-white
              border rounded-lg outline-none transition-colors
              placeholder:text-light-gray
              focus:ring-2 focus:ring-primary/20 focus:border-primary
              disabled:bg-surface disabled:text-medium-gray disabled:cursor-not-allowed
              ${error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border-gray'}
              ${rightElement ? 'pr-10' : ''}
              ${className}
            `}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {rightElement}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {!error && helper && <p className="text-xs text-medium-gray">{helper}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
