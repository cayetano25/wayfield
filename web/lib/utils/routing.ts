export interface UserContexts {
  organization_roles: string[];
  is_leader: boolean;
  leader_id: number | null;
}

export interface UserWithContexts {
  onboarding_completed_at: string | null;
  contexts: UserContexts;
}

export function getPostLoginRedirect(user: UserWithContexts): string {
  if (!user.onboarding_completed_at) return '/onboarding';
  if (user.contexts.organization_roles.length > 0) return '/dashboard';
  if (user.contexts.is_leader) return '/leader/dashboard';
  return '/my-workshops';
}
