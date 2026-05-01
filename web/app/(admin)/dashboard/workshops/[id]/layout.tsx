import { WorkshopShell } from '@/components/shared/WorkshopShell';

export default function WorkshopLayout({ children }: { children: React.ReactNode }) {
  return <WorkshopShell>{children}</WorkshopShell>;
}
