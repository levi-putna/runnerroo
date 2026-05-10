import { DailifyFullLogo } from "@/components/brand/dailify-logos"

/**
 * Centres auth flows with shared Dailify branding above the form.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        {/* Logo — full mark + wordmark */}
        <div className="mb-6 flex justify-center">
          <DailifyFullLogo className="h-10 w-auto max-w-[min(100%,260px)]" priority />
        </div>
        {children}
      </div>
    </div>
  )
}
