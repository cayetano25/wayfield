'use client'

import { useState, useEffect } from 'react'
import { MapPin } from 'lucide-react'

interface MapLinkProps {
  address: string
}

export function MapLink({ address }: MapLinkProps) {
  const encoded = encodeURIComponent(address)
  const googleUrl = `https://maps.google.com/?q=${encoded}`
  const appleUrl  = `https://maps.apple.com/?q=${encoded}`

  const [href, setHref] = useState(googleUrl)

  useEffect(() => {
    // iPads with iOS 13+ report MacIntel — maxTouchPoints distinguishes them from
    // real Macs, but both should open Apple Maps natively, so we treat them the same.
    const ua = navigator.userAgent
    const isApple =
      /iPad|iPhone|iPod/.test(ua) ||        // iOS
      /Macintosh/.test(ua)                   // macOS (Safari, Chrome on Mac)
    setHref(isApple ? appleUrl : googleUrl)
  }, [appleUrl, googleUrl])

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
        bg-white/15 hover:bg-white/25 border border-white/30
        text-white text-sm font-medium transition-colors"
    >
      <MapPin size={14} />
      Open in Maps
    </a>
  )
}
