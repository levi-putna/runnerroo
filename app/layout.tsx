import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "@teispace/next-themes"
import { getTheme } from "@teispace/next-themes/server"
import "./globals.css"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

/**
 * Site-wide document metadata — favicons, PWA manifest, and default title for marketing and app routes.
 */
export const metadata: Metadata = {
  title: "Dailify",
  description: "Visual workflow automation built on Vercel",
  manifest: "/site.webmanifest",
  appleWebApp: {
    title: "Dailify.ai",
  },
  icons: {
    icon: [
      {
        url: "/favicon/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/favicon/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/favicon/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
}

/**
 * Root HTML shell: fonts, theme (React 19–safe injection via @teispace/next-themes), and global UI providers.
 */
export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const initialTheme = await getTheme()

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} min-h-dvh antialiased`}
    >
      <body className="flex min-h-dvh flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          initialTheme={initialTheme ?? undefined}
        >
          <TooltipProvider delay={400} closeDelay={0}>
            {children}
            {/* Global toast surface — `toast()` from sonner works anywhere under this tree */}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
