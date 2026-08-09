"use client"

import { useEffect, useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  Code2,
  FileQuestion,
  LoaderCircle,
} from "lucide-react"

import { STATUS_VIEW } from "@/components/dashboard/status"
import { Badge } from "@/components/ui/badge"
import { MarkdownView } from "@/components/markdown-view"
import {
  loadChapterContent,
  type Chapter,
  type ChapterContent,
} from "@/lib/prom"
import { cn } from "@/lib/utils"

type Tab = "lecture" | "source"

const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: "lecture", label: "讲义", icon: BookOpen },
  { id: "source", label: "源码导读", icon: Code2 },
]

export function ChapterDetail({
  chapter,
  onBack,
}: {
  chapter: Chapter
  onBack: () => void
}) {
  const [tab, setTab] = useState<Tab>("lecture")
  const [content, setContent] = useState<ChapterContent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setTab("lecture")
    setContent(null)
    setLoading(true)
    loadChapterContent(chapter.id).then((loaded) => {
      if (cancelled) return
      setContent(loaded)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [chapter.id])

  const view = STATUS_VIEW[chapter.progress.status] ?? STATUS_VIEW.not_started
  const Icon = view.icon
  const body = content?.[tab]

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <aside className="w-full shrink-0 space-y-8 md:w-52">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          返回课程总览
        </button>

        <div className="space-y-1">
          <p className="text-sm leading-snug font-medium">{chapter.title}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {chapter.id} · 难度 {chapter.difficulty}
          </p>
          <Badge variant={view.variant}>
            <Icon className="size-3" />
            {view.label}
          </Badge>
        </div>

        <nav className="space-y-1">
          {TABS.map(({ id, label, icon: TabIcon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors",
                tab === id
                  ? "border-primary bg-muted font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <TabIcon className="size-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 space-y-5">
        <div className="pt-6">
          {loading ? (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              正在加载 …
            </p>
          ) : body ? (
            <MarkdownView content={body} />
          ) : (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <FileQuestion className="size-4" />
              {TABS.find((item) => item.id === tab)?.label}尚未生成
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
