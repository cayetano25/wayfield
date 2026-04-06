import { UserProvider } from '@/contexts/UserContext';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div className="min-h-full bg-surface flex flex-col">
        <div className="flex justify-center pt-8 pb-4">
          <span className="font-heading text-2xl font-extrabold text-primary">Wayfield</span>
        </div>
        <div className="flex-1 flex items-start justify-center px-4 pt-8 pb-12">
          {children}
        </div>
      </div>
    </UserProvider>
  );
}
