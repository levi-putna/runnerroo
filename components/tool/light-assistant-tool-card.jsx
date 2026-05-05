import { Check, AlertTriangle, Loader2 } from "lucide-react";
import { Shimmer } from "@/components/ai-elements/shimmer";

/**
 * LightAssistantToolCard Component
 * 
 * Lightweight card component for simple tool calling. Displays task and query
 * in a compact format with appropriate icons and shimmer effects for loading states.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} props.task - The task being performed (e.g., "reading", "retrieving")
 * @param {string} props.query - The query or target being acted upon (e.g., URL, search term)
 * @param {string} props.variant - Tool state variant: "output-available", "output-error", "input-streaming", "input-available", or undefined for default
 * 
 * @returns {JSX.Element} Rendered light card component
 */
export const LightAssistantToolCard = ({
  task,
  query,
  variant,
}) => {
  // Determine icon based on variant state (semantic / data-viz exception for success)
  const getIcon = () => {
    switch (variant) {
      case "output-available":
        return <Check size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />;
      case "output-error":
        return <AlertTriangle size={14} className="text-destructive flex-shrink-0" />;
      case "input-streaming":
      case "input-available":
      default:
        return <Loader2 size={14} className="text-muted-foreground/70 flex-shrink-0 animate-spin" />;
    }
  };

  // Determine if shimmer should be applied
  const shouldShimmer = variant === "input-streaming" || variant === "input-available" || !variant;

  // Format the display text
  const displayText = query ? `${task}: ${query}` : task;

  // Icon component
  const icon = getIcon();

  // Text content - wrapped in Shimmer if needed
  const textContent = shouldShimmer ? (
    <Shimmer as="span" className="truncate text-muted-foreground/70">
      {displayText}
    </Shimmer>
  ) : (
    <span className="truncate text-muted-foreground/70">{displayText}</span>
  );

  return (
    <div className="text-sm w-full text-foreground">
      <div className="py-2 flex items-center gap-2">
        {icon}
        {textContent}
      </div>
    </div>
  );
};
