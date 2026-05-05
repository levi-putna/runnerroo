import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "@teispace/next-themes"
import { getTheme } from "@teispace/next-themes/server"
import "./globals.css"
import { TooltipProvider } from "@/components/ui/tooltip"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Runneroo",
  description: "Visual workflow automation built on Vercel",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col overflow-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          initialTheme={initialTheme ?? undefined}
        >
          <TooltipProvider delay={400} closeDelay={0}>
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
