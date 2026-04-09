// The login page uses its own full-screen split-panel layout.
// Other auth pages (register, forgot-password, reset-password, verify-email)
// render their own <AuthCard> wrapper directly.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full">{children}</div>
}
