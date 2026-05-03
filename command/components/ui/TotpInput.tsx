'use client';

import { useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';

interface TotpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TotpInput({ value, onChange, disabled = false }: TotpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function focusCell(i: number) {
    refs.current[Math.max(0, Math.min(5, i))]?.focus();
  }

  function handleChange(idx: number, e: ChangeEvent<HTMLInputElement>) {
    const digit = e.target.value.replace(/\D/g, '').slice(-1);
    if (!digit) return;

    const arr = Array.from({ length: 6 }, (_, i) => value[i] || '');
    arr[idx] = digit;

    let last = -1;
    for (let i = 5; i >= 0; i--) {
      if (arr[i]) { last = i; break; }
    }

    onChange(last < 0 ? '' : arr.slice(0, last + 1).join(''));

    if (idx < 5) setTimeout(() => focusCell(idx + 1), 0);
  }

  function handleKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[idx]) {
        onChange(value.slice(0, idx));
      } else if (idx > 0) {
        onChange(value.slice(0, idx - 1));
        focusCell(idx - 1);
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      focusCell(idx - 1);
    } else if (e.key === 'ArrowRight' && idx < 5) {
      e.preventDefault();
      focusCell(idx + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(digits);
    focusCell(Math.min(digits.length, 5));
  }

  function handleFocus(idx: number) {
    if (idx > value.length) {
      focusCell(value.length);
    }
  }

  return (
    <div className="flex gap-2" role="group" aria-label="One-time password">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]"
          maxLength={1}
          value={value[i] || ''}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          autoComplete="one-time-code"
          className="w-11 h-14 text-center text-xl font-mono font-bold border-2 border-gray-200 rounded-xl bg-white focus:border-[#0FA3B1] focus:outline-none focus:ring-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={() => handleFocus(i)}
        />
      ))}
    </div>
  );
}
