export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-[480px] bg-white rounded-xl shadow-[0px_12px_32px_rgba(46,46,46,0.10)] border border-border-gray p-8">
        {/* Wayfield wordmark */}
        <div className="text-center mb-8">
          <span className="font-heading text-3xl font-extrabold text-primary">Wayfield</span>
        </div>
        {children}
      </div>
    </div>
  );
}
