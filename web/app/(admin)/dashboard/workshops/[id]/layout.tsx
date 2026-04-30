import { WorkshopTabs } from '@/components/shared/WorkshopTabs';

export default function WorkshopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-8 -mt-8 flex flex-col min-h-full">
      <WorkshopTabs />
      <div className="p-8">
        {children}
      </div>
    </div>
  );
}
