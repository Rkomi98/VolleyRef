"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

// Low-level Base UI building blocks, kept available for call sites that need
// full control (multiple triggers sharing one delay group, custom placement,
// etc). The design-system-facing `Tooltip` component below is a thin,
// restyled wrapper over these that reproduces the VolleyRef prototype's
// hover/focus bubble using Base UI's real positioning + portal engine
// instead of the prototype's hand-rolled `useState` toggle.
function TooltipProvider({ delay = 0, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />
}

function TooltipRoot({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export interface TooltipProps {
  content?: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
}

/**
 * VolleyRef's hover/focus label bubble — the design-system-facing API
 * ported from `overlay/Tooltip.jsx`. Internally it composes the Base UI
 * tooltip primitives above (real anchor positioning, portal, delay group)
 * instead of the prototype's manual open/close `useState`.
 */
export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  if (!content) return <>{children}</>
  return (
    <TooltipRoot>
      <TooltipTrigger render={<span style={{ display: "inline-flex" }} />}>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={6}
        style={{
          background: "var(--color-text-primary)",
          color: "var(--color-white)",
          padding: "6px 10px",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--text-xs)",
          fontFamily: "var(--font-body)",
          whiteSpace: "nowrap",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {content}
      </TooltipContent>
    </TooltipRoot>
  )
}

export { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent }
