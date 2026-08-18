"use client"

import * as React from "react"

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style"> {
  children?: React.ReactNode
  padding?: number | string
  interactive?: boolean
  style?: React.CSSProperties
}

export function Card({ children, padding = 20, interactive = false, style, ...rest }: CardProps) {
  const [hover, setHover] = React.useState(false)
  return (
    <div
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding,
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-xs)",
        transition: "box-shadow var(--duration-base) var(--ease-standard)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}
