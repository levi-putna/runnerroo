import { tool } from "ai";
import { z } from "zod";

/**
 * Surfaces a downloadable file as a styled row (icon, name, type, size, link)
 * instead of a bare URL in assistant replies.
 */
export const showDocumentDownload = tool({
  description:
    "Show a downloadable file or document to the user as a rich card with filename, type, optional size, and a Download action. Use whenever you mention a file the user can download or open (reports, exports, attachments). Pass the direct download or document URL.",
  inputSchema: z.object({
    url: z.string().url().describe("HTTPS URL where the user can download or open the file."),
    fileName: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Display filename including extension (e.g. Summary-of-php.docx). Omit only if unknown; the UI will infer from the URL."
      ),
    fileLabel: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Human-readable type line under the name (e.g. "Microsoft Word"). Omit to infer from extension.'
      ),
    sizeDisplay: z
      .string()
      .min(1)
      .optional()
      .describe('Optional size text shown to the user (e.g. "350 KB"). Omit if unknown.'),
  }),
  execute: async ({ url, fileName, fileLabel, sizeDisplay }) => {
    return {
      url,
      ...(fileName !== undefined ? { fileName } : {}),
      ...(fileLabel !== undefined ? { fileLabel } : {}),
      ...(sizeDisplay !== undefined ? { sizeDisplay } : {}),
    };
  },
});
