'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Copy, Check, Download, Printer, Maximize2 } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

interface QRCodeModalProps {
  joinCode: string;
  workshopTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QRCodeModal({ joinCode, workshopTitle, isOpen, onClose }: QRCodeModalProps) {
  const joinUrl = `https://wayfield.app/j/${joinCode}`;

  const [copied, setCopied] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Release wake lock and reset on modal close
  useEffect(() => {
    if (!isOpen) {
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
      setFullScreen(false);
      setCopied(false);
    }
  }, [isOpen]);

  // Escape key exits full-screen first, then closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fullScreen) {
          exitFullScreen();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, fullScreen, onClose]);

  const enterFullScreen = useCallback(async () => {
    setFullScreen(true);
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch {
        // Wake lock not granted — not fatal
      }
    }
  }, []);

  const exitFullScreen = useCallback(() => {
    setFullScreen(false);
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — no-op
    }
  }

  function downloadQR() {
    const canvas = document.getElementById('qr-download-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `wayfield-qr-${joinCode}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function printQR() {
    window.print();
  }

  if (!isOpen) return null;

  // ── Full-screen overlay ──────────────────────────────────────────────────
  if (fullScreen) {
    return (
      <>
        <PrintContent joinUrl={joinUrl} joinCode={joinCode} workshopTitle={workshopTitle} />
        <div
          role="button"
          tabIndex={0}
          aria-label="Tap to exit full screen"
          onClick={exitFullScreen}
          onKeyDown={(e) => e.key === 'Enter' && exitFullScreen()}
          className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center cursor-pointer select-none"
          data-testid="qr-fullscreen"
        >
          <div className="flex flex-col items-center gap-6 px-8" style={{ maxWidth: 'min(80vw, 80vh)' }}>
            <QRCodeSVG
              value={joinUrl}
              size={Math.min(
                typeof window !== 'undefined' ? window.innerWidth * 0.8 : 400,
                typeof window !== 'undefined' ? window.innerHeight * 0.7 : 400,
              )}
              level="H"
              includeMargin={true}
              fgColor="#2E2E2E"
              bgColor="#FFFFFF"
            />
            <p className="font-mono text-3xl font-bold tracking-widest text-dark">
              {joinCode}
            </p>
          </div>
          <p className="absolute bottom-8 text-xs text-gray-300">Tap anywhere to exit</p>
        </div>
      </>
    );
  }

  // ── Normal modal ─────────────────────────────────────────────────────────
  return (
    <>
      <PrintContent joinUrl={joinUrl} joinCode={joinCode} workshopTitle={workshopTitle} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-dark/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <div
          className="relative w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden"
          data-testid="qr-modal"
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-0">
            <div>
              <h2 className="font-heading text-xl font-bold text-dark">Workshop QR Code</h2>
              <p className="text-sm text-gray-500 mt-0.5 leading-snug">{workshopTitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-dark hover:bg-gray-100 transition-colors -mt-0.5 -mr-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* QR + code */}
          <div className="flex flex-col items-center gap-3 px-6 py-6">
            <div id="print-qr-content" className="flex flex-col items-center gap-3">
              {/* Visible SVG */}
              <QRCodeSVG
                value={joinUrl}
                size={260}
                level="H"
                includeMargin={true}
                fgColor="#2E2E2E"
                bgColor="#FFFFFF"
                data-testid="qr-svg"
              />

              {/* Hidden canvas used only for PNG download */}
              <QRCodeCanvas
                id="qr-download-canvas"
                value={joinUrl}
                size={800}
                level="H"
                includeMargin={true}
                style={{ display: 'none' }}
              />

              <p className="font-mono text-2xl font-bold tracking-widest text-dark">
                {joinCode}
              </p>
              <p className="text-sm text-gray-400 text-center">Scan to join or enter code manually</p>
              <p className="text-xs text-gray-400 text-center font-mono">
                wayfield.app/j/{joinCode}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-6 pb-6 space-y-2.5">
            {/* Copy + Download row */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={copyLink}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary text-primary text-sm font-semibold hover:bg-primary/5 active:scale-[0.98] transition-all"
                data-testid="copy-link-btn"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied ✓
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={downloadQR}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary text-primary text-sm font-semibold hover:bg-primary/5 active:scale-[0.98] transition-all"
                data-testid="download-btn"
              >
                <Download className="w-4 h-4" />
                Download QR
              </button>
            </div>

            {/* Print */}
            <button
              type="button"
              onClick={printQR}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all"
              data-testid="print-btn"
            >
              <Printer className="w-4 h-4" />
              Print QR Code
            </button>

            {/* Full screen */}
            <button
              type="button"
              onClick={enterFullScreen}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all"
              data-testid="fullscreen-btn"
            >
              <Maximize2 className="w-4 h-4" />
              Full Screen
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Printable content — only visible when window.print() is called
function PrintContent({
  joinUrl,
  joinCode,
  workshopTitle,
}: {
  joinUrl: string;
  joinCode: string;
  workshopTitle: string;
}) {
  return (
    <div id="print-only-qr" aria-hidden="true">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-only-qr,
          #print-only-qr * { visibility: visible !important; }
          #print-only-qr {
            position: fixed;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            background: white;
            padding: 40px;
          }
        }
      `}</style>
      <p className="hidden print:block font-heading text-2xl font-bold text-dark">Wayfield</p>
      <p className="hidden print:block text-base text-gray-600">{workshopTitle}</p>
      {/* Render a standalone 400×400 canvas for print — large enough for 8cm+ at 96 dpi */}
      <QRCodeCanvas
        id="qr-print-canvas"
        value={joinUrl}
        size={400}
        level="H"
        includeMargin={true}
        className="hidden print:block"
      />
      <p className="hidden print:block font-mono text-xl font-bold tracking-widest text-dark">
        {joinCode}
      </p>
      <p className="hidden print:block text-sm text-gray-500">
        Scan with your camera to join this workshop
      </p>
      <p className="hidden print:block text-xs text-gray-400 font-mono">
        {joinUrl}
      </p>
    </div>
  );
}
