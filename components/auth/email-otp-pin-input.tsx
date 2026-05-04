"use client"

import { PinInput } from "@ark-ui/react/pin-input"
import { cn } from "@/lib/utils"

/** Matches Supabase email OTP templates (six-digit PIN). */
export const AUTH_EMAIL_OTP_LENGTH = 6

type EmailOtpPinInputProps = {
  /** Visible label for the PIN row (associated via Ark PinInput.Label). */
  label: string
  /** Full OTP string (digits only; typically length ≤ count). */
  value: string
  invalid?: boolean
  /** Slot count; defaults to six-digit Supabase email codes. */
  count?: number
  required?: boolean
  /** Optional extra class on root for layout (for example full width). */
  className?: string
  onValueChange: (args: { valueAsString: string }) => void
}

/**
 * Email verification OTP: one slot per digit, automatic focus advance between slots,
 * whole-code paste, and `autocomplete="one-time-code"` via Ark PinInput&apos;s hidden input.
 *
 * Aligns with common guidance for OTP forms (numeric keypad, paste support).
 *
 * @see https://web.dev/articles/sms-otp-form
 */
export function EmailOtpPinInput({
  label,
  value,
  invalid = false,
  count = AUTH_EMAIL_OTP_LENGTH,
  required = false,
  className,
  onValueChange,
}: EmailOtpPinInputProps) {
  const cells = Array.from({ length: count }, (_, index) => value[index] ?? "")

  return (
    <PinInput.Root
      count={count}
      otp
      type="numeric"
      required={required}
      invalid={invalid}
      value={cells}
      onValueChange={({ valueAsString }) => {
        onValueChange({ valueAsString })
      }}
      className={className}
    >
      {/* Accessible label tied to the control */}
      <PinInput.Label className="mb-1.5 block text-sm font-medium">{label}</PinInput.Label>
      {/* One input per digit; Ark manages focus movement and paste across slots */}
      <PinInput.Control className="flex justify-center gap-2">
        {Array.from({ length: count }, (_, index) => (
          <PinInput.Input
            key={index}
            index={index}
            className={cn(
              "h-12 w-12 rounded-lg border border-input bg-transparent text-center text-lg font-medium outline-none transition-colors",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
              "dark:bg-input/30 dark:disabled:bg-input/80",
              "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            )}
          />
        ))}
      </PinInput.Control>
      {/* Hidden field carries OTP autocomplete semantics for supporting browsers */}
      <PinInput.HiddenInput />
    </PinInput.Root>
  )
}
