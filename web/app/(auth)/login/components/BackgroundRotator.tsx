'use client'

import Image from 'next/image'
import { useState } from 'react'
import { AUTH_BACKGROUNDS, ROTATION_INTERVAL_MS, TRANSITION_DURATION_MS } from '../config/backgrounds'
import { useInterval } from '@/hooks/useInterval'

export function BackgroundRotator() {
  const [activeIndex, setActiveIndex] = useState(0)

  useInterval(() => {
    setActiveIndex((prev) => (prev + 1) % AUTH_BACKGROUNDS.length)
  }, ROTATION_INTERVAL_MS)

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      role="img"
      aria-label="Rotating photography workshop and nature backgrounds"
    >
      {AUTH_BACKGROUNDS.map((bg, index) => (
        <div
          key={bg.src}
          className="absolute inset-0"
          style={{
            opacity: index === activeIndex ? 1 : 0,
            transition: `opacity ${TRANSITION_DURATION_MS}ms ease-in-out`,
            zIndex: index === activeIndex ? 1 : 0,
          }}
        >
          <Image
            src={bg.src}
            alt={bg.alt}
            fill
            priority={index === 0}
            loading={index === 0 ? 'eager' : 'lazy'}
            className="object-cover object-center"
            sizes="(max-width: 768px) 100vw, 55vw"
            quality={85}
          />
        </div>
      ))}

      {/* Dark gradient overlay — sits above all image layers */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 2,
          background: `
            linear-gradient(
              to bottom,
              rgba(15, 20, 30, 0.55) 0%,
              rgba(15, 20, 30, 0.50) 40%,
              rgba(15, 20, 30, 0.65) 75%,
              rgba(15, 20, 30, 0.80) 100%
            )
          `,
        }}
        aria-hidden="true"
      />

      {/* Progress indicator dots */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5"
        style={{ zIndex: 3 }}
        aria-hidden="true"
      >
        {AUTH_BACKGROUNDS.map((_, index) => (
          <div
            key={index}
            className="rounded-full transition-all duration-500"
            style={{
              width: index === activeIndex ? '20px' : '6px',
              height: '4px',
              backgroundColor:
                index === activeIndex ? '#0FA3B1' : 'rgba(255,255,255,0.35)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
