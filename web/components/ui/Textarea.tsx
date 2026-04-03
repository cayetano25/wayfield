'use client';

import { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helper, className = '', id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-dark">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full px-3 py-2.5 text-sm text-dark bg-white
            border rounded-lg outline-none resize-y transition-colors
            placeholder:text-light-gray
            focus:ring-2 focus:ring-primary/20 focus:border-primary
            disabled:bg-surface disabled:text-medium-gray disabled:cursor-not-allowed
            ${error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border-gray'}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        {!error && helper && <p className="text-xs text-medium-gray">{helper}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
