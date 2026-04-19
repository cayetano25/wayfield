import { UserProvider } from '@/contexts/UserContext';
import { ToastProvider } from '@/components/ui/Toast';
import { ParticipantShell } from '@/components/shared/ParticipantShell';

export default function ParticipantLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <ToastProvider />
      <ParticipantShell>{children}</ParticipantShell>
    </UserProvider>
  );
}
