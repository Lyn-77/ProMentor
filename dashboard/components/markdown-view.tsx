"use client"

import { Streamdown } from "streamdown"
import "streamdown/styles.css"

export function MarkdownView({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <Streamdown mode="static" className={className}>
      {content}
    </Streamdown>
  )
}
