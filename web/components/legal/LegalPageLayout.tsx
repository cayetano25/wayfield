'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface LegalPageLayoutProps {
  title: string
  effectiveDate: string
  tier?: 1 | 2 | 3
  children: React.ReactNode
}

const TIER_LABELS = {
  1: 'Core Terms',
  2: 'Data & Security',
  3: 'Community & Product',
}

export default function LegalPageLayout({
  title, effectiveDate, tier, children
}: LegalPageLayoutProps) {

  const formattedDate = new Date(effectiveDate).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="min-h-screen bg-white">

      {/* Dark header — matches footer brand */}
      <div className="bg-[#2E2E2E] text-white py-14 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-5">
            <Link href="/legal"
              className="text-xs text-gray-400 hover:text-gray-300
                transition-colors flex items-center gap-1">
              <ChevronLeft size={12} /> Legal
            </Link>
            {tier && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-xs text-gray-500 font-mono">
                  {TIER_LABELS[tier]}
                </span>
              </>
            )}
          </div>
          <h1 className="text-3xl font-bold font-heading mb-3">{title}</h1>
          <p className="text-sm text-gray-400">
            Effective Date: {formattedDate}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="
          [&_h2]:font-heading [&_h2]:font-semibold [&_h2]:text-lg
          [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-gray-900
          [&_h3]:font-heading [&_h3]:font-semibold [&_h3]:text-base
          [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-gray-900
          [&_p]:text-gray-600 [&_p]:leading-relaxed [&_p]:mb-4
          [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ul]:pl-5
          [&_ol]:mb-4 [&_ol]:space-y-1.5 [&_ol]:pl-5
          [&_li]:text-gray-600 [&_li]:leading-relaxed
          [&_strong]:text-gray-900 [&_strong]:font-semibold
          [&_a]:text-[#0FA3B1] [&_a]:no-underline hover:[&_a]:underline
          [&_table]:text-sm [&_table]:w-full [&_table]:mb-4
          [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-700
          [&_th]:py-2 [&_th]:pr-4 [&_th]:border-b [&_th]:border-gray-200
          [&_td]:text-gray-600 [&_td]:py-2 [&_td]:pr-4
          [&_td]:border-b [&_td]:border-gray-100
        ">
          {children}
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200">
          <Link href="/legal"
            className="text-sm text-[#0FA3B1] hover:text-[#0c8a96]
              flex items-center gap-1.5 transition-colors">
            <ChevronLeft size={14} /> View all legal documents
          </Link>
        </div>
      </div>
    </div>
  )
}
