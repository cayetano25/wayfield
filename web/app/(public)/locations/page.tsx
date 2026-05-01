import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Workshop Locations | Wayfield',
  description: 'Browse Wayfield workshops by city, region, or country.',
}

export default function LocationsPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center gap-2 rounded-full
          bg-[#0FA3B1]/10 border border-[#0FA3B1]/20 px-4 py-1.5 mb-6">
          <span className="text-xs font-bold text-[#0FA3B1] uppercase
            tracking-wider font-mono">
            Coming Soon
          </span>
        </div>
        <h1 className="text-3xl font-bold font-heading text-gray-900 mb-4">
          Workshop Locations
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Discover workshops near you or explore new destinations for creative learning.
        </p>
        <Link href="/"
          className="text-sm font-medium text-[#0FA3B1]
            hover:text-[#0c8a96] transition-colors">
          ← Back to home
        </Link>
      </div>
    </div>
  )
}
