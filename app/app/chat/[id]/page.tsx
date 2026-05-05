import { AssistantContextProvider } from "@/components/assistant/assistant-context";
import { AssistantShell } from "@/components/assistant/assistant-shell";

/**
 * Deep-link entry point for a specific conversation.
 * Passes the conversation ID to the provider so it loads the correct history on mount.
 */
export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AssistantContextProvider initialConversationId={id}>
        <AssistantShell />
      </AssistantContextProvider>
    </div>
  );
}
