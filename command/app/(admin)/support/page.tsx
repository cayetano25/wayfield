'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Headphones } from 'lucide-react';
import { useAdminUser, can } from '@/contexts/AdminUserContext';
import { PageHeader } from '@/components/ui/PageHeader';

const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_TOOL_URL ?? '';

export default function SupportPage() {
  const { adminUser } = useAdminUser();
  const router = useRouter();

  useEffect(() => {
    if (adminUser && !can.viewSupport(adminUser.role)) {
      router.replace('/');
    }
  }, [adminUser, router]);

  return (
    <div className="max-w-6xl">
      <PageHeader title="Support" />

      <div className="flex items-center justify-center min-h-[400px]">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-10 flex flex-col items-center gap-6 w-full max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center">
            <Headphones size={26} className="text-[#0FA3B1]" />
          </div>

          <div>
            <h2 className="font-heading text-lg font-semibold text-gray-900 mb-2">
              Support Tickets
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Support tickets are managed in an external tool. Click the button below to
              open the support dashboard.
            </p>
          </div>

          {SUPPORT_URL ? (
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[44px] px-6 rounded-lg bg-[#0FA3B1] text-white text-sm font-medium hover:bg-[#0d8f9c] transition-colors"
            >
              Open Support Tool
              <ExternalLink size={14} />
            </a>
          ) : (
            <button
              disabled
              className="inline-flex items-center gap-2 min-h-[44px] px-6 rounded-lg bg-gray-200 text-gray-400 text-sm font-medium cursor-not-allowed"
              aria-label="Support tool URL not configured"
            >
              Open Support Tool
              <ExternalLink size={14} />
            </button>
          )}

          {!SUPPORT_URL && (
            <p className="text-xs text-gray-400">
              Set <code className="font-mono bg-gray-100 px-1 rounded">NEXT_PUBLIC_SUPPORT_TOOL_URL</code> to
              enable this button.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
