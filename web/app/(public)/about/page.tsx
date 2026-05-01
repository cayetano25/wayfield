import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Wayfield',
  description: 'Wayfield was built to make creative education workshops easier to organize and more accessible to participants.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <div className="bg-[#2E2E2E] text-white py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold font-heading mb-3">About Wayfield</h1>
          <p className="text-gray-400">
            Built to make creative education workshops easier to organize and more accessible to participants.
          </p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-gray-500">Content coming soon.</p>
      </div>
    </div>
  )
}
