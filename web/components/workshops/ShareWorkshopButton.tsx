'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Share2, Link2, Check } from 'lucide-react';

// ---- inline social SVG icons ------------------------------------------------

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ---- component --------------------------------------------------------------

export interface ShareWorkshopButtonProps {
  workshopTitle: string;
  /** Absolute URL (preferred) or a /w/{slug} relative path. Resolved to absolute on client. */
  publicUrl: string;
  variant?: 'organizer' | 'participant';
  /** Show "Share" text label. Defaults true for organizer, false for participant. */
  showLabel?: boolean;
  disabled?: boolean;
  disabledTooltip?: string;
  /** Extra classes applied to the trigger button. Useful for theme overrides (e.g. white on dark hero). */
  className?: string;
}

export function ShareWorkshopButton({
  workshopTitle,
  publicUrl,
  variant = 'participant',
  showLabel,
  disabled = false,
  disabledTooltip,
  className,
}: ShareWorkshopButtonProps) {
  const showText = showLabel ?? variant === 'organizer';

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve relative /w/{slug} paths to absolute after hydration.
  const [absUrl, setAbsUrl] = useState<string>(
    publicUrl.startsWith('http') ? publicUrl : '',
  );
  useEffect(() => {
    if (!publicUrl.startsWith('http')) {
      const path = publicUrl.startsWith('/') ? publicUrl : `/${publicUrl}`;
      setAbsUrl(`${window.location.origin}${path}`);
    }
  }, [publicUrl]);

  const url = absUrl || publicUrl;

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleTriggerClick = useCallback(
    async (e: React.MouseEvent) => {
      // Always stop propagation so the button is safe inside <Link> wrappers.
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title: workshopTitle, url });
          return;
        } catch {
          // User cancelled or browser denied — fall through to dropdown.
        }
      }
      setOpen((prev) => !prev);
    },
    [disabled, workshopTitle, url],
  );

  async function copyLink(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — silently fail.
    }
  }

  const shareItems = [
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      icon: <FacebookIcon />,
      color: '#1877F2',
    },
    {
      label: 'X',
      href: `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(workshopTitle)}`,
      icon: <XIcon />,
      color: '#000000',
    },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      icon: <LinkedInIcon />,
      color: '#0A66C2',
    },
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(`${workshopTitle} ${url}`)}`,
      icon: <WhatsAppIcon />,
      color: '#25D366',
    },
  ];

  // Base trigger classes per variant (overrideable via className prop).
  const defaultTriggerCls =
    variant === 'organizer'
      ? `inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-sm font-medium transition-colors ${
          disabled
            ? 'border-border-gray text-light-gray cursor-not-allowed opacity-50 bg-white'
            : 'border-border-gray text-dark bg-white hover:bg-surface hover:border-medium-gray cursor-pointer'
        }`
      : 'p-1.5 rounded-md transition-colors text-light-gray hover:text-primary hover:bg-primary/5';

  const triggerCls = className
    ? `${defaultTriggerCls} ${className}`
    : defaultTriggerCls;

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={handleTriggerClick}
        disabled={disabled}
        title={disabled && disabledTooltip ? disabledTooltip : 'Share workshop'}
        aria-label="Share workshop"
        className={triggerCls}
      >
        <Share2 className={variant === 'organizer' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        {showText && <span>Share</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-border-gray w-48 py-1.5 overflow-hidden">
          {/* Copy link */}
          <button
            type="button"
            onClick={copyLink}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark hover:bg-surface transition-colors text-left"
          >
            {copied ? (
              <Check className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <Link2 className="w-4 h-4 text-light-gray shrink-0" />
            )}
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>

          <div className="border-t border-border-gray my-1" />

          {/* Social share items */}
          {shareItems.map(({ label, href, icon, color }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark hover:bg-surface transition-colors"
            >
              <span style={{ color }} className="shrink-0 flex items-center">
                {icon}
              </span>
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
