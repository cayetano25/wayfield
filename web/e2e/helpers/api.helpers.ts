const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8000'

async function apiFetch(
  method: string,
  path: string,
  body?: object,
  token?: string,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

export async function apiPost(path: string, body: object, token?: string) {
  const res = await apiFetch('POST', path, body, token)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API POST ${path} failed ${res.status}: ${text}`)
  }
  return res.json()
}

export async function apiGet(path: string, token: string) {
  const res = await apiFetch('GET', path, undefined, token)
  if (!res.ok) throw new Error(`API GET ${path} failed ${res.status}`)
  return res.json()
}

export async function apiDelete(path: string, token: string) {
  const res = await apiFetch('DELETE', path, undefined, token)
  if (!res.ok) throw new Error(`API DELETE ${path} failed ${res.status}`)
  return res.json()
}

export async function loginViaApi(email: string, password: string): Promise<string> {
  const data = await apiPost('/api/v1/auth/login', { email, password })
  return data.token as string
}

export async function resetDatabase(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/testing/reset`, { method: 'POST' })
  if (!res.ok) throw new Error('Database reset failed — is APP_ENV=local?')
}

export async function getInvitationToken(invitationId: number): Promise<string> {
  const res = await fetch(
    `${API_BASE}/api/testing/invitation-token/${invitationId}`,
  )
  const data = await res.json()
  return data.raw_token as string
}

export async function getOrgInvitationToken(invitationId: number): Promise<string> {
  const res = await fetch(
    `${API_BASE}/api/testing/org-invitation-token/${invitationId}`,
  )
  const data = await res.json()
  return data.raw_token as string
}

export async function apiPatch(path: string, body: object, token: string) {
  const res = await apiFetch('PATCH', path, body, token)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API PATCH ${path} failed ${res.status}: ${text}`)
  }
  return res.json()
}
