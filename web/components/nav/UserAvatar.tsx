// components/nav/UserAvatar.tsx

import Image from 'next/image'

interface UserAvatarProps {
  firstName:        string
  lastName:         string
  profileImageUrl?: string | null
  size?:            number
}

export function UserAvatar({
  firstName,
  lastName,
  profileImageUrl,
  size = 32,
}: UserAvatarProps) {
  const initials = buildInitials(firstName, lastName)
  const fontSize = size <= 32 ? 12 : size <= 40 ? 14 : 16

  if (profileImageUrl) {
    return (
      <div
        className="relative rounded-full overflow-hidden flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <Image
          src={profileImageUrl}
          alt={`${firstName} ${lastName}`}
          fill
          className="object-cover"
          sizes={`${size}px`}
        />
      </div>
    )
  }

  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center
                 select-none"
      style={{
        width:           size,
        height:          size,
        backgroundColor: '#0FA3B1',
        fontSize:        fontSize,
        fontFamily:      'Sora, sans-serif',
        fontWeight:      600,
        color:           '#ffffff',
        lineHeight:      1,
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

function buildInitials(firstName: string, lastName: string): string {
  const f = (firstName ?? '').trim()
  const l = (lastName  ?? '').trim()
  const first  = f.length > 0 ? f[0].toUpperCase() : ''
  const second = l.length > 0 ? l[0].toUpperCase() : ''
  return first + second || '?'
}
