'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OrgSlugRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const router   = useRouter()

  useEffect(() => {
    // Leave a hint so UserContext can activate the right org on admin load
    try {
      sessionStorage.setItem('pendingOrgSlug', slug)
    } catch {
      // sessionStorage not available (SSR guard — should never happen in client component)
    }
    router.replace('/admin/dashboard')
  }, [slug, router])

  return (
    <div style={{
      minHeight:      'calc(100vh - 56px)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      <div
        style={{
          width:        32,
          height:       32,
          borderRadius: '50%',
          border:       '3px solid #E5E7EB',
          borderTop:    '3px solid #0FA3B1',
          animation:    'spin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
