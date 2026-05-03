export interface LeaderInvitationActionData {
  type?:             'leader_invitation'
  invitation_id:     number
  accept_token:      string
  decline_token:     string
  organization_name: string
  workshop_title:    string | null
  inviter_name:      string
  accept_url:        string
  decline_url:       string
}

export interface OrgInvitationActionData {
  type:              'org_invitation'
  invitation_token:  string
  organization_name: string
  role:              string
}

export type NotificationActionData = LeaderInvitationActionData | OrgInvitationActionData

export interface AppNotification {
  recipient_id:          number
  notification_id:       number
  title:                 string
  message:               string
  notification_type:     'informational' | 'urgent' | 'reminder'
  notification_category: 'message' | 'invitation' | 'system'
  action_data:           NotificationActionData | null
  is_read:               boolean
  read_at:               string | null
  created_at:            string
  is_invitation:         boolean
  is_system:             boolean
}

export interface NotificationsResponse {
  data: AppNotification[]
  pagination: {
    current_page: number
    total_pages:  number
    total:        number
    per_page:     number
  }
  meta?: {
    unread_count:      number
    has_urgent_unread: boolean
    has_leader_unread: boolean
  }
}

export type InvitationActionResult = 'accepted' | 'declined' | 'error'

export interface UnreadMeta {
  unread_count:        number
  has_urgent_unread:   boolean
  has_leader_unread:   boolean
  has_support_replies: boolean
}

/* --- Participant notification types (notifications page) --------------- */

export type NotificationSender =
  | { type: 'organizer'; name: string; display_label: string }
  | { type: 'leader'; first_name: string; last_name: string; display_label: string; profile_image_url: string | null }

export type SessionContext = {
  session_id:        number
  session_title:     string
  start_at:          string
  end_at:            string
  workshop_timezone: string
} | null

export type WorkshopContext = {
  workshop_id:    number
  workshop_title: string
}

export interface OrgInvitationAction {
  type:              'org_invitation'
  token:             string
  organization_name: string | null
  role:              string | null
  accept_url:        string
  decline_url:       string
}

export interface ParticipantNotification {
  id:                number
  notification_id:   number
  title:             string
  message:           string
  notification_type: 'informational' | 'urgent' | 'reminder'
  sender_scope:      'organizer' | 'leader'
  sender:            NotificationSender
  session_context:   SessionContext
  workshop_context:  WorkshopContext | null
  in_app_status:     'pending' | 'delivered' | 'read'
  read_at:           string | null
  sent_at:           string
  is_invitation:     boolean
  invitation_action: OrgInvitationAction | null
}
