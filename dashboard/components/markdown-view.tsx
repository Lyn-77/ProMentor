"use client"

import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
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
        <Streamdown
            plugins={{
                code,
                mermaid,
                math,
                cjk
            }}
            mode="static"
            className={className}
        >
            {content}
        </Streamdown>
    )
}
