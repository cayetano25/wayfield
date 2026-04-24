'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { useInterval } from '@/hooks/useInterval'
import { HERO_IMAGES, HERO_ROTATION_INTERVAL_MS } from '@/lib/heroImages'

export interface FeaturedWorkshop {
  id: number
  title: string
  description: string
  imageUrl: string
  instructorAvatars: string[]
  totalInstructors: number
  startingPrice: number
  publicSlug: string
}

interface Props {
  featuredWorkshop?: FeaturedWorkshop | null
  onSearch: (query: string) => void
}

const TRANSITION_DURATION_MS = 1000
const PLACEHOLDER_GRADIENT =
  'linear-gradient(135deg, #0c6b75 0%, #0FA3B1 30%, #1a1a2e 80%, #2E2E2E 100%)'

export function DiscoverHero({ featuredWorkshop = null, onSearch }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [erroredImages, setErroredImages] = useState<Set<number>>(new Set())
  const [searchValue, setSearchValue] = useState('')
  const [cardImageError, setCardImageError] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  // Pause rotation when hero scrolls out of viewport
  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useInterval(
    () => setActiveIndex((prev) => (prev + 1) % HERO_IMAGES.length),
    isVisible ? HERO_ROTATION_INTERVAL_MS : null,
  )

  function handleSearch() {
    onSearch(searchValue.trim())
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch()
  }

  const descSnippet = featuredWorkshop
    ? (() => {
        const plain = featuredWorkshop.description.replace(/<[^>]*>/g, '');
        return plain.slice(0, 80) + (plain.length > 80 ? '…' : '');
      })()
    : ''

  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-[400px] md:min-h-[480px] md:max-h-[560px] overflow-hidden"
    >
      {/* Gradient fallback — always rendered below image layers */}
      <div
        className="absolute inset-0"
        style={{ zIndex: 0, background: PLACEHOLDER_GRADIENT }}
        aria-hidden="true"
      />

      {/* Rotating background images — same pattern as BackgroundRotator */}
      <div
        className="absolute inset-0 overflow-hidden"
        role="img"
        aria-label="Rotating creative workshop backgrounds"
      >
        {HERO_IMAGES.map((img, index) => (
          <div
            key={img.src}
            className="absolute inset-0"
            style={{
              opacity: !erroredImages.has(index) && index === activeIndex ? 1 : 0,
              transition: `opacity ${TRANSITION_DURATION_MS}ms ease-in-out`,
              zIndex: index === activeIndex ? 1 : 0,
            }}
          >
            {!erroredImages.has(index) && (
              <Image
                src={img.src}
                alt={img.alt}
                fill
                priority={index === 0}
                loading={index === 0 ? 'eager' : 'lazy'}
                className="object-cover object-center"
                sizes="100vw"
                quality={85}
                onError={() =>
                  setErroredImages((prev) => new Set([...prev, index]))
                }
              />
            )}
          </div>
        ))}
      </div>

      {/* Dark gradient overlay — left-heavy for text legibility */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/20"
        style={{ zIndex: 10 }}
        aria-hidden="true"
      />

      {/* Content layer */}
      <div className="relative flex items-center" style={{ zIndex: 20 }}>
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center py-16 lg:py-20">

            {/* Left: eyebrow + headline + subheadline + search */}
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] uppercase text-white/70 mb-4 font-mono animate-fade-in-up">
                Elevate Your Craft
              </p>

              <h1 className="text-5xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tight mb-5 font-heading animate-fade-in-up delay-80">
                Find your next<br />creative experience
              </h1>

              <p className="text-base lg:text-lg text-white/75 leading-relaxed mb-8 max-w-md font-sans animate-fade-in-up delay-160">
                Join master artisans and digital pioneers in curated workshops designed to push
                the boundaries of your creative potential.
              </p>

              {/* Search bar */}
              <div className="animate-fade-in-up delay-240">
                <div className="flex flex-col sm:flex-row sm:items-center bg-white rounded-full shadow-lg overflow-hidden max-w-[460px]">
                  <div className="flex items-center flex-1 min-w-0">
                    <Search
                      className="shrink-0 text-gray-400 ml-5 mr-3"
                      size={18}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="What do you want to learn?"
                      aria-label="Search workshops"
                      className="flex-1 py-4 text-gray-900 text-sm bg-transparent border-none outline-none placeholder:text-gray-400 min-w-0"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="m-1.5 px-6 py-3 bg-[#0FA3B1] hover:bg-[#0c8a96] text-white font-semibold text-sm rounded-full transition-colors whitespace-nowrap font-sans"
                  >
                    Explore Workshops
                  </button>
                </div>
              </div>
            </div>

            {/* Right: featured workshop card (desktop only) */}
            {featuredWorkshop && (
              <div className="hidden lg:block">
                <Link href={`/w/${featuredWorkshop.publicSlug}`} className="block max-w-[320px] ml-auto">
                  <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    {/* Card image */}
                    <div className="relative h-44">
                      {featuredWorkshop.imageUrl && !cardImageError ? (
                        <Image
                          src={featuredWorkshop.imageUrl}
                          alt={featuredWorkshop.title}
                          fill
                          className="object-cover"
                          sizes="320px"
                          onError={() => setCardImageError(true)}
                        />
                      ) : (
                        <div
                          className="absolute inset-0"
                          style={{ background: PLACEHOLDER_GRADIENT }}
                          aria-hidden="true"
                        />
                      )}
                      <span className="absolute top-3 left-3 bg-white text-gray-900 text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full shadow-sm font-mono">
                        Featured
                      </span>
                    </div>

                    {/* Card body */}
                    <div className="p-5">
                      <h3 className="text-lg font-bold text-gray-900 leading-snug mb-1.5 font-heading line-clamp-2">
                        {featuredWorkshop.title}
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed mb-4">
                        {descSnippet}
                      </p>

                      <div className="flex justify-between items-center">
                        {/* Instructor avatar stack */}
                        <div className="flex -space-x-2">
                          {featuredWorkshop.instructorAvatars.slice(0, 3).map((avatar, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={avatar}
                              alt=""
                              className="w-7 h-7 rounded-full border-2 border-white object-cover"
                            />
                          ))}
                          {featuredWorkshop.totalInstructors > 3 && (
                            <span className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] font-semibold text-gray-600">
                              +{featuredWorkshop.totalInstructors - 3}
                            </span>
                          )}
                        </div>

                        {/* Price — hidden for now */}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  )
}
