import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Lock, FileCheck, Network, ChevronRight } from 'lucide-react'
import { LEGAL_DOCUMENTS } from '@/lib/footerConfig'

export const metadata: Metadata = {
  title: 'Security & Trust | Wayfield',
  description: 'How Wayfield approaches security, privacy, compliance, and data handling to protect organizers, leaders, and participants.',
}

const PILLARS = [
  {
    icon: Shield,
    title: 'Infrastructure Security',
    body: 'We use encryption, access controls, authentication, and logging to protect your data at rest and in transit.',
    link: '/legal/security-policy',
    linkLabel: 'Security Policy',
  },
  {
    icon: Lock,
    title: 'Privacy by Design',
    body: 'Personal data is collected only as needed, retained only as long as required, and never sold to third parties.',
    link: '/legal/privacy',
    linkLabel: 'Privacy Policy',
  },
  {
    icon: FileCheck,
    title: 'Compliance Ready',
    body: 'Wayfield supports GDPR, CCPA, and other data protection frameworks. Enterprise customers may request our Data Processing Agreement.',
    link: '/legal/data-processing',
    linkLabel: 'Data Processing Agreement',
  },
  {
    icon: Network,
    title: 'Vendor Transparency',
    body: 'We maintain a public list of the third-party subprocessors we use to deliver the Wayfield service.',
    link: '/legal/subprocessors',
    linkLabel: 'View Subprocessors',
  },
]

export default function SecurityPage() {
  return (
    <div className="min-h-screen">

      {/* Hero */}
      <div className="bg-[#2E2E2E] text-white py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full
            bg-[#0FA3B1]/20 border border-[#0FA3B1]/30 px-4 py-1.5 mb-6">
            <Shield size={14} className="text-[#0FA3B1]" />
            <span className="text-sm text-[#0FA3B1] font-medium">
              Security & Trust
            </span>
          </div>
          <h1 className="text-4xl font-bold font-heading mb-4">
            Your data, handled with care
          </h1>
          <p className="text-lg text-gray-300 leading-relaxed">
            Wayfield is built to protect the data of organizers, leaders,
            and participants. Here is how we approach security, privacy,
            and compliance.
          </p>
        </div>
      </div>

      {/* Pillars */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-16">
          {PILLARS.map(p => (
            <div key={p.title} className="rounded-2xl border border-gray-200 p-6
              hover:border-[#0FA3B1] hover:shadow-sm transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#0FA3B1]/10 flex items-center
                justify-center mb-4 group-hover:bg-[#0FA3B1]/20 transition-colors">
                <p.icon size={20} className="text-[#0FA3B1]" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                {p.title}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                {p.body}
              </p>
              <Link href={p.link}
                className="text-sm font-medium text-[#0FA3B1] hover:text-[#0c8a96]
                  flex items-center gap-1 transition-colors">
                {p.linkLabel} <ChevronRight size={13} />
              </Link>
            </div>
          ))}
        </div>

        {/* All legal documents */}
        <div className="mb-16">
          <h2 className="text-xl font-bold font-heading text-gray-900 mb-2">
            Legal and Compliance Documents
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Full details on our commitments and policies.
          </p>
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
            {LEGAL_DOCUMENTS.map(doc => (
              <Link key={doc.href} href={doc.href}
                className="flex items-center justify-between px-5 py-4
                  hover:bg-gray-50 transition-colors group">
                <div>
                  <p className="text-sm font-medium text-gray-900
                    group-hover:text-[#0FA3B1] transition-colors">
                    {doc.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{doc.description}</p>
                </div>
                <ChevronRight size={15} className="text-gray-300
                  group-hover:text-[#0FA3B1] transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-8 text-center">
          <h2 className="text-lg font-semibold font-heading text-gray-900 mb-2">
            Security questions or disclosures?
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Contact us at security@wayfield.com for responsible disclosure
            or compliance inquiries.
          </p>
          <Link href="/contact"
            className="inline-flex items-center gap-2 bg-[#0FA3B1] text-white
              font-medium px-5 py-2.5 rounded-xl text-sm hover:bg-[#0c8a96]
              transition-colors">
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  )
}
