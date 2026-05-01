import type { Metadata } from 'next'
import Link from 'next/link'
import { LEGAL_DOCUMENTS } from '@/lib/footerConfig'

export const metadata: Metadata = {
  title: 'Legal Documents | Wayfield',
  description: 'Terms of service, privacy policy, and all legal documents governing your use of Wayfield.',
}

const TIER_HEADINGS = {
  1: { label: 'Core Terms', description: 'Required agreements for all users of the Wayfield platform.' },
  2: { label: 'Data, Security & Compliance', description: 'Data processing, security practices, and enterprise compliance.' },
  3: { label: 'Community & Product Policies', description: 'Guidelines for conduct, AI features, and software use.' },
}

const TIERS = [1, 2, 3] as const

export default function LegalIndexPage() {
  return (
    <div className="min-h-screen">

      {/* Header */}
      <div className="bg-[#2E2E2E] text-white py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold font-heading mb-3">Legal Documents</h1>
          <p className="text-gray-400">
            All policies and agreements governing your use of Wayfield.
          </p>
        </div>
      </div>

      {/* Document sections by tier */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {TIERS.map(tier => {
          const tierDocs = LEGAL_DOCUMENTS.filter(d => d.tier === tier)
          const heading = TIER_HEADINGS[tier]
          return (
            <section key={tier}>
              <div className="mb-6">
                <h2 className="text-xl font-bold font-heading text-gray-900 mb-1">
                  {heading.label}
                </h2>
                <p className="text-sm text-gray-500">{heading.description}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tierDocs.map(doc => (
                  <Link key={doc.href} href={doc.href}
                    className="h-full rounded-xl border border-gray-200 p-5
                      hover:border-[#0FA3B1] hover:shadow-sm transition-all group
                      flex flex-col">
                    <h3 className="font-semibold text-gray-900 text-sm mb-2
                      group-hover:text-[#0FA3B1] transition-colors">
                      {doc.title}
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3 flex-1">
                      {doc.description}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono">
                      Effective {new Date(doc.effectiveDate).toLocaleDateString(
                        'en-US', { year: 'numeric', month: 'short', day: 'numeric' }
                      )}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
