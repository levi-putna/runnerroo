/**
 * Helpers for {@link import('./show-document-download').showDocumentDownload} UI:
 * derive labels from filenames and URLs when the model omits optional fields.
 */

const EXTENSION_KIND: Record<string, { badge: string; label: string }> = {
  pdf: { badge: ".PDF", label: "PDF document" },
  doc: { badge: ".DOC", label: "Microsoft Word" },
  docx: { badge: ".DOCX", label: "Microsoft Word" },
  xls: { badge: ".XLS", label: "Microsoft Excel" },
  xlsx: { badge: ".XLSX", label: "Microsoft Excel" },
  ppt: { badge: ".PPT", label: "Microsoft PowerPoint" },
  pptx: { badge: ".PPTX", label: "Microsoft PowerPoint" },
  txt: { badge: ".TXT", label: "Plain text" },
  csv: { badge: ".CSV", label: "CSV" },
  zip: { badge: ".ZIP", label: "ZIP archive" },
  rar: { badge: ".RAR", label: "Archive" },
  png: { badge: ".PNG", label: "PNG image" },
  jpg: { badge: ".JPG", label: "JPEG image" },
  jpeg: { badge: ".JPG", label: "JPEG image" },
  gif: { badge: ".GIF", label: "GIF image" },
  webp: { badge: ".WEBP", label: "WebP image" },
  md: { badge: ".MD", label: "Markdown" },
  json: { badge: ".JSON", label: "JSON" },
};

/**
 * Extracts the filename segment from a URL path for display.
 */
export function filenameFromUrl({ url }: { url: string }) {
  try {
    const path = new URL(url).pathname;
    const segment = path.split("/").filter(Boolean).pop();
    return segment && segment.length > 0 ? decodeURIComponent(segment) : "Download";
  } catch {
    return "Download";
  }
}

/**
 * Normalises an extension string (with or without leading dot).
 */
function normaliseExtension({ raw }: { raw: string }) {
  const trimmed = raw.replace(/^\./, "").toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Reads file extension from a filename or URL pathname.
 */
export function extensionFromNameOrUrl({ fileName, url }: { fileName: string; url: string }) {
  const nameExt = fileName.includes(".") ? fileName.split(".").pop() : null;
  if (nameExt) {
    const n = normaliseExtension({ raw: nameExt });
    if (n) return n;
  }
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").filter(Boolean).pop() ?? "";
    const parts = base.split(".");
    if (parts.length > 1) {
      return normaliseExtension({ raw: parts.pop() ?? "" });
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Badge text (e.g. `.PDF`) and human-readable kind label for the subtitle row.
 */
export function badgeAndLabelForFile({
  fileName,
  url,
  fileLabel,
}: {
  fileName: string;
  url: string;
  fileLabel?: string;
}) {
  if (fileLabel !== undefined && fileLabel.trim().length > 0) {
    const ext = extensionFromNameOrUrl({ fileName, url });
    const fromMap = ext ? EXTENSION_KIND[ext] : undefined;
    const badge =
      fromMap?.badge ??
      (ext ? `.${ext.toUpperCase().slice(0, 8)}` : ".FILE");
    return { badge, label: fileLabel.trim() };
  }

  const ext = extensionFromNameOrUrl({ fileName, url });
  if (ext && EXTENSION_KIND[ext]) {
    return { badge: EXTENSION_KIND[ext].badge, label: EXTENSION_KIND[ext].label };
  }
  if (ext) {
    return {
      badge: `.${ext.toUpperCase().slice(0, 8)}`,
      label: "Document",
    };
  }
  return { badge: ".FILE", label: "Document" };
}
