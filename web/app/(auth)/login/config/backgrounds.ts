export interface BackgroundImage {
  src: string
  alt: string
  credit?: string
}

export const AUTH_BACKGROUNDS: BackgroundImage[] = [
  {
    src: '/images/auth/bg-1.webp',
    alt: 'Mountain summit at golden hour',
    credit: 'Mountain landscape',
  },
  {
    src: '/images/auth/bg-2.webp',
    alt: 'Misty forest waterfall',
    credit: 'Forest waterfall',
  },
  {
    src: '/images/auth/bg-3.webp',
    alt: 'Rocky coastline at dusk',
    credit: 'Coastal rocks',
  },
  {
    src: '/images/auth/bg-4.webp',
    alt: 'Redwood forest trail in morning fog',
    credit: 'Redwood trail',
  },
  {
    src: '/images/auth/bg-5.webp',
    alt: 'Alpine lake with mountain reflection',
    credit: 'Alpine lake',
  },
  {
    src: '/images/auth/bg-6.webp',
    alt: 'Desert canyon at sunset',
    credit: 'Desert canyon',
  },
]

export const ROTATION_INTERVAL_MS = 7000
export const TRANSITION_DURATION_MS = 1200
