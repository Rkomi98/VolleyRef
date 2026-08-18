"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

// Low-level Base UI building blocks (the root primitive is renamed
// `DialogRoot` — instead of the generic shadcn `Dialog` — so the
// design-system-facing `Dialog` component below, matching
// `overlay/Dialog.jsx`'s `{ open, onClose, title, description, footer,
// size }` API, can own the plain `Dialog` name). Kept exported for call
// sites that want the full shadcn trigger/close/header/footer building
// blocks instead.
function DialogRoot({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 !h-7 !w-7 !p-0"
              />
            }
          >
            <XIcon size={16} />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="secondary" />}>Close</DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-base leading-none font-medium", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export interface DialogProps {
  open: boolean
  onClose?: () => void
  title: string
  description?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: "sm" | "md" | "lg"
}

const dialogWidths: Record<"sm" | "md" | "lg", number> = { sm: 400, md: 520, lg: 680 }

/**
 * VolleyRef's modal shell — the design-system-facing API ported from
 * `overlay/Dialog.jsx`. It's built on `DialogRoot`/`DialogPrimitive.Popup`
 * above instead of the prototype's hand-rolled `<div role="dialog">`, so it
 * gets a real focus trap, a portal, scroll locking, and Escape/outside-press
 * dismissal from Base UI rather than a manual `keydown` listener and
 * `onClick`/`stopPropagation` pair. No close (×) button is rendered by
 * default — same as the original, which relies on Escape, backdrop click,
 * or the caller's own footer actions.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: DialogProps) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose?.()
      }}
    >
      <DialogPortal>
        <DialogPrimitive.Backdrop
          data-slot="dialog-overlay"
          style={{ position: "fixed", inset: 0, background: "rgba(23,33,43,0.45)", zIndex: 100 }}
        />
        <DialogPrimitive.Popup
          aria-label={title}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: `min(calc(100% - 40px), ${dialogWidths[size] || dialogWidths.md}px)`,
            background: "var(--color-white)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            maxHeight: "86vh",
            display: "flex",
            flexDirection: "column",
            zIndex: 100,
            outline: "none",
          }}
        >
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-default)" }}>
            <DialogPrimitive.Title
              style={{
                fontSize: "var(--text-xl)",
                fontFamily: "var(--font-display)",
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description
                style={{ marginTop: 6, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}
              >
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <div style={{ padding: "20px 24px", overflowY: "auto" }}>{children}</div>
          {footer && (
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border-default)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              {footer}
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </DialogRoot>
  )
}

export {
  DialogRoot,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
