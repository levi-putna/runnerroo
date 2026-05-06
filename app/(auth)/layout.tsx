import { DailifyMark, DailifyWordmark } from "@/components/brand/dailify-logos"

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
        {/* Logo — icon + wordmark */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-3">
            <DailifyMark className="h-10 w-auto shrink-0" />
            <DailifyWordmark className="h-7 w-auto max-w-[200px]" />
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
