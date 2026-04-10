import { UserProvider } from '@/contexts/UserContext';
import { ToastProvider } from '@/components/ui/Toast';
import { LeaderShell } from '@/components/shared/LeaderShell';

export default function LeaderLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <ToastProvider />
      <LeaderShell>{children}</LeaderShell>
    </UserProvider>
  );
}
