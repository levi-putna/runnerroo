"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import type { ChatStatus, FileUIPart } from "ai";
import { CornerDownLeftIcon, PaperclipIcon, SquareIcon, XIcon } from "lucide-react";
import { nanoid } from "nanoid";
import type {
  ChangeEvent,
  ChangeEventHandler,
  ClipboardEventHandler,
  ComponentProps,
  FormEvent,
  FormEventHandler,
  HTMLAttributes,
  KeyboardEventHandler,
  PropsWithChildren,
  RefObject,
} from "react";
import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ============================================================================
// Helpers
// ============================================================================

const convertBlobUrlToDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// ============================================================================
// Provider Context & Types
// ============================================================================

export interface AttachmentsContext {
  files: (FileUIPart & { id: string })[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  clear: () => void;
  openFileDialog: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export interface TextInputContext {
  value: string;
  setInput: (v: string) => void;
  clear: () => void;
}

export interface PromptInputControllerProps {
  textInput: TextInputContext;
  attachments: AttachmentsContext;
  __registerFileInput: (
    ref: RefObject<HTMLInputElement | null>,
    open: () => void
  ) => void;
}

const PromptInputController = createContext<PromptInputControllerProps | null>(null);
const ProviderAttachmentsContext = createContext<AttachmentsContext | null>(null);

export const usePromptInputController = () => {
  const ctx = useContext(PromptInputController);
  if (!ctx) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use usePromptInputController()."
    );
  }
  return ctx;
};

const useOptionalPromptInputController = () => useContext(PromptInputController);

export const useProviderAttachments = () => {
  const ctx = useContext(ProviderAttachmentsContext);
  if (!ctx) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use useProviderAttachments()."
    );
  }
  return ctx;
};

const useOptionalProviderAttachments = () => useContext(ProviderAttachmentsContext);

export type PromptInputProviderProps = PropsWithChildren<{
  initialInput?: string;
}>;

export const PromptInputProvider = ({
  initialInput: initialTextInput = "",
  children,
}: PromptInputProviderProps) => {
  const [textInput, setTextInput] = useState(initialTextInput);
  const clearInput = useCallback(() => setTextInput(""), []);

  const [attachmentFiles, setAttachmentFiles] = useState<(FileUIPart & { id: string })[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openRef = useRef<() => void>(() => {});

  const add = useCallback((files: File[] | FileList) => {
    const incoming = [...files];
    if (incoming.length === 0) return;
    setAttachmentFiles((prev) => [
      ...prev,
      ...incoming.map((file) => ({
        filename: file.name,
        id: nanoid(),
        mediaType: file.type,
        type: "file" as const,
        url: URL.createObjectURL(file),
      })),
    ]);
  }, []);

  const remove = useCallback((id: string) => {
    setAttachmentFiles((prev) => {
      const found = prev.find((f) => f.id === id);
      if (found?.url) URL.revokeObjectURL(found.url);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setAttachmentFiles((prev) => {
      for (const f of prev) {
        if (f.url) URL.revokeObjectURL(f.url);
      }
      return [];
    });
  }, []);

  const attachmentsRef = useRef(attachmentFiles);
  useEffect(() => { attachmentsRef.current = attachmentFiles; }, [attachmentFiles]);
  useEffect(() => () => {
    for (const f of attachmentsRef.current) {
      if (f.url) URL.revokeObjectURL(f.url);
    }
  }, []);

  const openFileDialog = useCallback(() => { openRef.current?.(); }, []);

  const attachments = useMemo<AttachmentsContext>(
    () => ({ add, clear, fileInputRef, files: attachmentFiles, openFileDialog, remove }),
    [attachmentFiles, add, remove, clear, openFileDialog]
  );

  const __registerFileInput = useCallback(
    (ref: RefObject<HTMLInputElement | null>, open: () => void) => {
      fileInputRef.current = ref.current;
      openRef.current = open;
    },
    []
  );

  const controller = useMemo<PromptInputControllerProps>(
    () => ({
      __registerFileInput,
      attachments,
      textInput: { clear: clearInput, setInput: setTextInput, value: textInput },
    }),
    [textInput, clearInput, attachments, __registerFileInput]
  );

  return (
    <PromptInputController.Provider value={controller}>
      <ProviderAttachmentsContext.Provider value={attachments}>
        {children}
      </ProviderAttachmentsContext.Provider>
    </PromptInputController.Provider>
  );
};

// ============================================================================
// Component Context & Hooks
// ============================================================================

const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null);

export const usePromptInputAttachments = () => {
  const provider = useOptionalProviderAttachments();
  const local = useContext(LocalAttachmentsContext);
  const context = local ?? provider;
  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput or PromptInputProvider"
    );
  }
  return context;
};

// ============================================================================
// PromptInput
// ============================================================================

export interface PromptInputMessage {
  content: string;
  attachments?: FileUIPart[];
}

export type PromptInputProps = HTMLAttributes<HTMLFormElement> & {
  status?: ChatStatus;
  value?: string;
  onValueChange?: (v: string) => void;
  onSubmit?: (message: PromptInputMessage) => void;
  onStop?: () => void;
};

export const PromptInput = ({
  status = "ready",
  value: controlledValue,
  onValueChange,
  onSubmit,
  onStop,
  className,
  children,
  ...props
}: PromptInputProps) => {
  const controller = useOptionalPromptInputController();

  const [localValue, setLocalValue] = useState(
    controller?.textInput.value ?? controlledValue ?? ""
  );

  const value =
    controlledValue !== undefined
      ? controlledValue
      : (controller?.textInput.value ?? localValue);

  const setValue = useCallback(
    (v: string) => {
      if (controlledValue === undefined && !controller) setLocalValue(v);
      onValueChange?.(v);
      controller?.textInput.setInput(v);
    },
    [controlledValue, controller, onValueChange]
  );

  // Local attachments state when no provider
  const [localFiles, setLocalFiles] = useState<(FileUIPart & { id: string })[]>([]);
  const localFileInputRef = useRef<HTMLInputElement | null>(null);
  const openLocalFileDialog = useCallback(() => localFileInputRef.current?.click(), []);

  const localAttachments = useMemo<AttachmentsContext>(
    () => ({
      files: localFiles,
      add: (files: File[] | FileList) => {
        const incoming = [...files];
        if (incoming.length === 0) return;
        setLocalFiles((prev) => [
          ...prev,
          ...incoming.map((file) => ({
            filename: file.name,
            id: nanoid(),
            mediaType: file.type,
            type: "file" as const,
            url: URL.createObjectURL(file),
          })),
        ]);
      },
      remove: (id: string) => {
        setLocalFiles((prev) => {
          const found = prev.find((f) => f.id === id);
          if (found?.url) URL.revokeObjectURL(found.url);
          return prev.filter((f) => f.id !== id);
        });
      },
      clear: () => {
        setLocalFiles((prev) => {
          for (const f of prev) if (f.url) URL.revokeObjectURL(f.url);
          return [];
        });
      },
      openFileDialog: openLocalFileDialog,
      fileInputRef: localFileInputRef,
    }),
    [localFiles, openLocalFileDialog]
  );

  const attachments = controller?.attachments ?? localAttachments;

  const handleSubmit: FormEventHandler = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (status !== "ready" || !value.trim()) return;

      const resolvedFiles = await Promise.all(
        attachments.files.map(async (f) => {
          const dataUrl = f.url ? await convertBlobUrlToDataUrl(f.url) : null;
          return { ...f, url: dataUrl ?? f.url ?? "" };
        })
      );

      onSubmit?.({ content: value, attachments: resolvedFiles });
      setValue("");
      attachments.clear();
      controller?.textInput.clear();
    },
    [status, value, attachments, onSubmit, setValue, controller]
  );

  return (
    <LocalAttachmentsContext.Provider value={attachments}>
      <form
        className={cn("flex flex-col gap-2", className)}
        onSubmit={handleSubmit}
        {...props}
      >
        {children}
      </form>
    </LocalAttachmentsContext.Provider>
  );
};

// ============================================================================
// PromptInputTextarea
// ============================================================================

export type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea> & {
  onSubmit?: () => void;
};

export const PromptInputTextarea = ({
  onSubmit,
  onKeyDown,
  onChange,
  value,
  className,
  placeholder = "Message…",
  rows = 1,
  ...props
}: PromptInputTextareaProps) => {
  const controller = useOptionalPromptInputController();
  const providerValue = controller?.textInput.value;

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit?.();
        e.currentTarget.closest("form")?.requestSubmit();
      }
      onKeyDown?.(e);
    },
    [onKeyDown, onSubmit]
  );

  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      controller?.textInput.setInput(e.target.value);
      onChange?.(e);
    },
    [controller, onChange]
  );

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      const attachments = controller?.attachments;
      if (!attachments) return;
      const files = [...(e.clipboardData?.files ?? [])];
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length > 0) {
        e.preventDefault();
        attachments.add(images);
      }
    },
    [controller]
  );

  return (
    <InputGroupTextarea
      className={cn(
        "min-h-[2.5rem] max-h-[calc(5lh+1rem)] resize-none overflow-y-auto",
        className
      )}
      onKeyDown={handleKeyDown}
      onChange={onChange ?? handleChange}
      onPaste={handlePaste}
      value={value ?? providerValue}
      placeholder={placeholder}
      rows={rows}
      {...props}
    />
  );
};

// ============================================================================
// PromptInputFooter
// ============================================================================

export type PromptInputFooterProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputFooter = ({ className, children, ...props }: PromptInputFooterProps) => (
  <div className={cn("flex items-center justify-between gap-2 px-1 pb-1", className)} {...props}>
    {children}
  </div>
);

// ============================================================================
// PromptInputSubmit
// ============================================================================

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
  onStop?: () => void;
};

export const PromptInputSubmit = ({
  status = "ready",
  onStop,
  children,
  className,
  ...props
}: PromptInputSubmitProps) => {
  const isStreaming = status === "streaming" || status === "submitted";

  if (isStreaming && onStop) {
    return (
      <InputGroupButton
        type="button"
        onClick={onStop}
        className={cn("shrink-0", className)}
        {...props}
      >
        {children ?? <SquareIcon className="size-3.5 fill-current" />}
      </InputGroupButton>
    );
  }

  return (
    <InputGroupButton
      type="submit"
      disabled={status !== "ready" || !isStreaming}
      className={cn("shrink-0", className)}
      {...props}
    >
      {children ?? <CornerDownLeftIcon className="size-3.5" />}
    </InputGroupButton>
  );
};

// ============================================================================
// PromptInputAttachButton
// ============================================================================

export type PromptInputAttachButtonProps = ComponentProps<typeof InputGroupButton>;

export const PromptInputAttachButton = ({
  className,
  children,
  onClick,
  ...props
}: PromptInputAttachButtonProps) => {
  const attachments = usePromptInputAttachments();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
    onClick?.(new MouseEvent("click") as never);
  }, [onClick]);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) attachments.add(files);
      e.target.value = "";
    },
    [attachments]
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={handleFileChange}
        accept="image/*"
        tabIndex={-1}
      />
      <InputGroupButton
        type="button"
        onClick={handleClick}
        className={cn("shrink-0", className)}
        {...props}
      >
        {children ?? <PaperclipIcon className="size-3.5" />}
      </InputGroupButton>
    </>
  );
};

// ============================================================================
// PromptInputAttachmentList
// ============================================================================

export type PromptInputAttachmentListProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputAttachmentList = ({
  className,
  children,
  ...props
}: PromptInputAttachmentListProps) => {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0 && !children) return null;

  return (
    <div
      className={cn("flex flex-wrap gap-2 px-2 pt-2", className)}
      {...props}
    >
      {children ??
        attachments.files.map((file) => (
          <PromptInputAttachmentPreview key={file.id} file={file} />
        ))}
    </div>
  );
};

// ============================================================================
// PromptInputAttachmentPreview
// ============================================================================

export type PromptInputAttachmentPreviewProps = ComponentProps<"div"> & {
  file: FileUIPart & { id: string };
};

export const PromptInputAttachmentPreview = ({
  file,
  className,
  ...props
}: PromptInputAttachmentPreviewProps) => {
  const attachments = usePromptInputAttachments();

  const isImage = file.mediaType?.startsWith("image/");

  return (
    <div
      className={cn(
        "relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted",
        className
      )}
      {...props}
    >
      {isImage && file.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.url}
          alt={file.filename ?? "attachment"}
          className="size-full object-cover"
        />
      ) : (
        <span className="text-xs text-muted-foreground truncate px-1 text-center">
          {file.filename ?? "file"}
        </span>
      )}
      <button
        type="button"
        onClick={() => attachments.remove(file.id)}
        className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-foreground/70 text-background hover:bg-foreground"
        aria-label="Remove attachment"
      >
        <XIcon className="size-2.5" />
      </button>
    </div>
  );
};

// ============================================================================
// PromptInputRoot (wraps InputGroup + children for combined use)
// ============================================================================

export type PromptInputRootProps = ComponentProps<typeof InputGroup>;

export const PromptInputRoot = ({ className, children, ...props }: PromptInputRootProps) => (
  <InputGroup className={cn("h-auto flex-col py-1", className)} {...props}>
    {children}
  </InputGroup>
);

export { InputGroupAddon as PromptInputAddon };
