"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Low-level Base UI building blocks (renamed from the generic shadcn
// `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` names so the design-system
// `Tabs` component below — matching `data/Tabs.jsx`'s flat, panel-less API
// — can own the plain names). Kept exported for call sites that need a full
// tabs+panel widget with the default shadcn look.
function TabsRoot({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel data-slot="tabs-content" className={cn("flex-1 text-sm outline-none", className)} {...props} />
  )
}

export interface TabItem {
  value: string
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}

export interface TabsProps {
  tabs: TabItem[]
  value?: string
  onChange?: (value: string) => void
}

/**
 * VolleyRef's underlined tab bar — the design-system-facing API ported from
 * `data/Tabs.jsx`. It's navigation-only (no panels), so it's built directly
 * on `TabsRoot`/`TabsList`/`TabsTrigger` above for real roving-tabindex
 * keyboard navigation and ARIA wiring, restyled with the prototype's
 * underline look via the same CSS variables.
 */
export function Tabs({ tabs = [], value, onChange }: TabsProps) {
  return (
    <TabsRoot
      value={value}
      onValueChange={(v) => onChange && onChange(v as string)}
      className="!flex-row !gap-0"
    >
      <TabsList
        variant="line"
        className="!h-auto !w-full !justify-start !gap-1 !bg-transparent !p-0"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        {tabs.map((t) => {
          const isActive = t.value === value
          return (
            <TabsTrigger
              key={t.value}
              value={t.value}
              disabled={t.disabled}
              className="!h-auto !flex-none !rounded-none !border-none !bg-transparent !shadow-none after:hidden"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 6px",
                marginBottom: -1,
                borderBottom: `2px solid ${isActive ? "var(--color-primary)" : "transparent"}`,
                color: t.disabled
                  ? "var(--neutral-300)"
                  : isActive
                    ? "var(--color-primary-dark)"
                    : "var(--color-text-secondary)",
                fontFamily: "var(--font-body)",
                fontWeight: "var(--weight-semibold)",
                fontSize: "var(--text-base)",
              }}
            >
              {t.icon}
              {t.label}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </TabsRoot>
  )
}

export { TabsRoot, TabsList, TabsTrigger, TabsContent, tabsListVariants }
