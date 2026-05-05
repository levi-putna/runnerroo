import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GitBranch, Webhook } from "lucide-react"
import { PageHeader } from "@/components/page-header"

const integrations = [
  {
    id: "github",
    name: "GitHub",
    description: "Trigger workflows from GitHub events",
    icon: GitBranch,
    connected: false,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send notifications to Slack channels",
    icon: Webhook,
    connected: false,
  },
]

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Integrations" description="Connect external services to your workflows" />

      <div className="p-6 max-w-2xl mx-auto w-full space-y-6">
      <div className="space-y-3">
        {integrations.map((integration) => (
          <Card key={integration.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg border bg-muted shrink-0">
                  <integration.icon className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{integration.name}</h3>
                    {integration.connected && <Badge variant="default" className="text-xs">Connected</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                </div>
                <Button variant={integration.connected ? "outline" : "default"} size="sm">
                  {integration.connected ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </div>
  )
}
