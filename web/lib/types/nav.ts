// lib/types/nav.ts

export interface NavUser {
  id:                number
  first_name:        string
  last_name:         string
  email:             string
  profile_image_url: string | null
}

export interface NavContextData {
  isAuthenticated:    boolean
  isLoading:          boolean
  user:               NavUser | null
  showMyWorkshops:    boolean
  showMySessions:     boolean
  showMyOrganization: boolean
}

export const NAV_CONTEXT_DEFAULT: NavContextData = {
  isAuthenticated:    false,
  isLoading:          true,
  user:               null,
  showMyWorkshops:    false,
  showMySessions:     false,
  showMyOrganization: false,
}
