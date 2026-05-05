import { AssistantContextProvider } from "@/components/assistant/assistant-context";
import { AssistantShell } from "@/components/assistant/assistant-shell";

/**
 * New conversation entry point — no conversation ID, starts fresh.
 */
export default function ChatPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AssistantContextProvider>
        <AssistantShell />
      </AssistantContextProvider>
    </div>
  );
}
