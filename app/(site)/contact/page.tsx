import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Contact — Dailify",
  description: "Reach the Dailify team for sales, support, and partnerships.",
  openGraph: {
    title: "Contact — Dailify",
    description: "Reach the Dailify team for sales, support, and partnerships.",
  },
}

/**
 * Marketing contact page — mailto and in-app entry points.
 */
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl flex-1 px-4 py-16 sm:px-6">
      {/* Page header */}
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Contact us</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Tell us about your workflows, integrations, or security requirements. We read every message.
        </p>
      </header>

      {/* Cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Email</CardTitle>
            <CardDescription>Best for detailed questions and security reviews.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <a href="mailto:hello@dailify.app">hello@dailify.app</a>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Replace this address with your production inbox before launch.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Already using Dailify?</CardTitle>
            <CardDescription>Open the product for chat, runs, and workflow settings.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/signup">Create an account</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
