export interface UserContexts {
  organization_roles: string[];
  is_leader: boolean;
  leader_id: number | null;
}

export interface UserWithContexts {
  email_verified: boolean;
  onboarding_intent?: string | null;
  onboarding_completed_at: string | null;
  contexts: UserContexts;
}

export function getPostLoginRedirect(user: UserWithContexts): string {
  if (!user.email_verified) return '/verify-email';
  if (!user.onboarding_completed_at) return '/onboarding';
  if (user.contexts.organization_roles.length > 0) return '/dashboard';
  if (user.contexts.is_leader) return '/leader/dashboard';
  return '/discover';
}
