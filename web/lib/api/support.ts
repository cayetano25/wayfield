import { apiGet, apiPost } from './client'

export interface SupportMessage {
  id:          number
  body:        string
  sender_type: 'user' | 'admin'
  created_at:  string
}

export interface SupportTicket {
  id:                  number
  subject:             string
  status:              'open' | 'in_progress' | 'pending_user' | 'resolved' | 'closed'
  priority:            'low' | 'normal' | 'high' | 'urgent'
  category:            string | null
  created_at:          string
  closed_at:           string | null
  latest_admin_reply:  { body: string; created_at: string } | null
  messages:            SupportMessage[]
}

export async function fetchMyTickets(): Promise<SupportTicket[]> {
  const res = await apiGet<{ data: SupportTicket[] }>('/me/support/tickets')
  return res.data ?? []
}

export async function submitTicket(payload: {
  subject:   string
  body:      string
  category?: string
}): Promise<SupportTicket> {
  const res = await apiPost<{ data: SupportTicket }>('/me/support/tickets', payload)
  return res.data
}

export async function markTicketRead(ticketId: number): Promise<void> {
  await apiPost(`/notifications/support-tickets/${ticketId}/mark-read`)
}
