'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary text-white hover:bg-[#0d8f9c] active:bg-[#0b7a85] shadow-sm disabled:opacity-50',
  secondary:
    'bg-white text-dark border border-border-gray hover:bg-surface active:bg-[#eaeaea] shadow-sm disabled:opacity-50',
  danger:
    'bg-danger text-white hover:bg-[#d4432f] active:bg-[#be3a29] shadow-sm disabled:opacity-50',
  ghost:
    'bg-transparent text-medium-gray hover:bg-surface hover:text-dark disabled:opacity-50',
  icon:
    'bg-transparent text-medium-gray hover:bg-surface hover:text-dark rounded-full disabled:opacity-50',
};

const sizeClasses: Record<Size, string> = {
  lg: 'h-12 px-6 text-sm font-semibold rounded-lg',
  md: 'h-10 px-4 text-sm font-semibold rounded-lg',
  sm: 'h-8 px-3 text-xs font-semibold rounded-md',
};

const iconSizeClasses: Record<Size, string> = {
  lg: 'h-12 w-12',
  md: 'h-10 w-10',
  sm: 'h-8 w-8',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...props }, ref) => {
    const isIcon = variant === 'icon';
    const sizeClass = isIcon ? iconSizeClasses[size] : sizeClasses[size];

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2 font-sans
          transition-colors duration-150 cursor-pointer
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
          disabled:cursor-not-allowed
          ${variantClasses[variant]}
          ${sizeClass}
          ${className}
        `}
        {...props}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
      </button>
    );
  },
);

Button.displayName = 'Button';
