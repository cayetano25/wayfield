// lib/hooks/useNavContext.ts
// /me verified: contexts.is_leader ✓, contexts.organization_roles ✓, profile_image_url ✓
'use client'

import { useState, useEffect } from 'react'
import { NavContextData, NAV_CONTEXT_DEFAULT } from '@/lib/types/nav'
import { getToken } from '@/lib/auth/session'

// -- Module-level cache ----------------------------------------------------
// Stored outside React so it survives component unmounts and re-mounts.
// Route changes do NOT trigger re-fetches — only login and logout do.
// clearNavCache() resets both so the next mount fetches fresh data.

let cachedContext:   NavContextData | null       = null
let inflightPromise: Promise<NavContextData> | null = null

// Call this immediately after login and immediately after logout
// so the nav reflects the new auth state on the next render.
export function clearNavCache(): void {
  cachedContext   = null
  inflightPromise = null
}

export function useNavContext(): NavContextData {
  const [context, setContext] = useState<NavContextData>(
    cachedContext ?? NAV_CONTEXT_DEFAULT
  )

  useEffect(() => {
    // Already resolved — apply immediately, no fetch needed
    if (cachedContext) {
      setContext(cachedContext)
      return
    }

    // Deduplicate concurrent calls — only one fetch in flight at a time
    if (!inflightPromise) {
      inflightPromise = fetchNavContext()
    }

    let cancelled = false
    inflightPromise.then((result) => {
      if (!cancelled) {
        cachedContext = result
        setContext(result)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return context
}

// -- Internal fetch --------------------------------------------------------

async function fetchNavContext(): Promise<NavContextData> {
  try {
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'
    const token    = getToken()

    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${BASE_URL}/me`, { headers })

    if (res.status === 401 || res.status === 403) {
      return buildUnauthenticated()
    }

    if (!res.ok) {
      return buildUnauthenticated()
    }

    const data = await res.json()
    const contexts = data.contexts ?? {}

    return {
      isAuthenticated:    true,
      isLoading:          false,
      user: {
        id:                data.id,
        first_name:        data.first_name  ?? '',
        last_name:         data.last_name   ?? '',
        email:             data.email       ?? '',
        profile_image_url: data.profile_image_url ?? null,
      },
      showMyWorkshops:    true,
      showMySessions:     contexts.is_leader === true,
      showMyOrganization: Array.isArray(contexts.organization_roles)
                            && contexts.organization_roles.length > 0,
    }
  } catch {
    return buildUnauthenticated()
  }
}

function buildUnauthenticated(): NavContextData {
  return {
    isAuthenticated:    false,
    isLoading:          false,
    user:               null,
    showMyWorkshops:    false,
    showMySessions:     false,
    showMyOrganization: false,
  }
}
