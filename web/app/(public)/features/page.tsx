import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Features | Wayfield',
  description: 'Everything you need to run great creative education workshops.',
}

export default function FeaturesPage() {
  return (
    <div className="min-h-screen">
      <div className="bg-[#2E2E2E] text-white py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold font-heading mb-3">Features</h1>
          <p className="text-gray-400">
            Everything you need to run great creative education workshops.
          </p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-gray-500">Content coming soon.</p>
      </div>
    </div>
  )
}
