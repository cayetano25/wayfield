import type { OrgInvitationData } from '@/lib/types/invitations'

interface Props {
  invitation: OrgInvitationData
}

const ROLE_PERMISSIONS: Record<OrgInvitationData['role'], string> = {
  admin: 'Manage workshops, invite leaders, view all reports, manage team members',
  staff: 'Create and manage workshops, view rosters and attendance, send notifications',
  billing_admin: 'View and manage billing, subscription, and invoices',
}

export function OrgPreviewPanel({ invitation }: Props) {
  const { organization, role, role_display } = invitation
  const permissions = ROLE_PERMISSIONS[role]

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        width: '100%',
        border: '1px solid #F3F4F6',
      }}
    >
      {/* Eyebrow */}
      <p
        style={{
          fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
          fontSize: '10px',
          fontWeight: 700,
          color: '#9CA3AF',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '10px',
        }}
      >
        Your Invitation
      </p>

      {/* Org name */}
      <h3
        style={{
          fontFamily: 'var(--font-sora), Sora, sans-serif',
          fontSize: '20px',
          fontWeight: 700,
          color: '#2E2E2E',
          lineHeight: 1.3,
          margin: 0,
        }}
      >
        {organization.name}
      </h3>

      {/* Subtitle */}
      <p
        style={{
          fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
          fontSize: '13px',
          color: '#6B7280',
          marginTop: '4px',
          marginBottom: '16px',
        }}
      >
        You&apos;ve been invited to join {organization.name} as{' '}
        <strong style={{ color: '#2E2E2E' }}>{role_display}</strong>
      </p>

      {/* Role description card */}
      <div
        style={{
          background: '#F0FDFF',
          borderLeft: '3px solid #0FA3B1',
          borderRadius: '0 6px 6px 0',
          padding: '12px 16px',
          marginBottom: '16px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            color: '#0FA3B1',
            marginBottom: '4px',
          }}
        >
          Role: {role_display}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
            fontSize: '13px',
            color: '#374151',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {permissions}
        </p>
      </div>

      {/* Org stats */}
      <p
        style={{
          fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
          fontSize: '12px',
          color: '#6B7280',
          margin: 0,
        }}
      >
        {organization.workshops_count} {organization.workshops_count === 1 ? 'workshop' : 'workshops'}
        <span style={{ margin: '0 6px', color: '#D1D5DB' }}>·</span>
        {organization.members_count} {organization.members_count === 1 ? 'team member' : 'team members'}
      </p>
    </div>
  )
}
