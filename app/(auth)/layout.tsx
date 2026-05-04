import { Zap } from "lucide-react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
              <Zap className="size-4 text-primary-foreground fill-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Runneroo</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
