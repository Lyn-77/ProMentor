"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Code2,
  FileQuestion,
  LoaderCircle,
  PlayCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownView } from "@/components/markdown-view"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  loadChapterContent,
  loadCourse,
  type Chapter,
  type ChapterContent,
  type ChapterStatus,
  type Course,
} from "@/lib/prom"
import { cn } from "@/lib/utils"

const STATUS_VIEW: Record<
  ChapterStatus,
  { label: string; variant: "success" | "warning" | "muted"; icon: typeof CheckCircle2 }
> = {
  completed: { label: "已完成", variant: "success", icon: CheckCircle2 },
  in_progress: { label: "学习中", variant: "warning", icon: PlayCircle },
  not_started: { label: "未开始", variant: "muted", icon: Circle },
}

const DIFFICULTY_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  easy: "success",
  mid: "warning",
  hard: "destructive",
}

export default function Page() {
  const [course, setCourse] = useState<Course | null>(null)
  const [ready, setReady] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [content, setContent] = useState<ChapterContent | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadCourse()
      .then((loaded) => {
        if (!cancelled) setCourse(loaded)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const syncHash = () =>
      setActiveId(window.location.hash.replace(/^#/, "") || null)
    syncHash()
    window.addEventListener("hashchange", syncHash)
    return () => window.removeEventListener("hashchange", syncHash)
  }, [])

  const openChapter = useCallback(async (id: string) => {
    if (window.location.hash !== `#${id}`) {
      window.location.hash = id
    }
    setActiveId(id)
    setContent(null)
    setLoadingContent(true)
    try {
      const loaded = await loadChapterContent(id)
      setContent(loaded)
    } finally {
      setLoadingContent(false)
    }
  }, [])

  const closeChapter = useCallback(() => {
    window.location.hash = ""
    setActiveId(null)
    setContent(null)
  }, [])

  if (!ready) {
    return <Loading />
  }
  if (!course || !course.found) {
    return <EmptyState />
  }

  const active = activeId
    ? course.chapters.find((ch) => ch.id === activeId)
    : null

  return (
    <main className="mx-auto max-w-4xl p-6">
      {active ? (
        <ChapterDetail
          chapter={active}
          content={content}
          loading={loadingContent}
          onBack={closeChapter}
        />
      ) : (
        <Overview course={course} onOpen={openChapter} />
      )}
    </main>
  )
}

function Loading() {
  return (
    <main className="flex min-h-svh items-center justify-center gap-2 text-muted-foreground text-sm">
      <LoaderCircle className="size-4 animate-spin" />
      正在读取 .promentor/ …
    </main>
  )
}

function EmptyState() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>还没有课程</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            未在项目根目录找到 .promentor/。请先运行 /promentor init 生成课程，
            然后在项目根目录启动静态服务器访问本页面。
          </p>
        </CardContent>
      </Card>
    </main>
  )
}

function Overview({
  course,
  onOpen,
}: {
  course: Course
  onOpen: (id: string) => void
}) {
  const current = course.current
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-medium">{course.name}</h1>
        <p className="text-muted-foreground text-sm">
          {course.language} · 数据源 .promentor/
        </p>
      </header>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm">总体进度</span>
            <span className="font-medium text-sm">{course.percent.toFixed(1)}%</span>
          </div>
          <Progress value={course.percent} />
          <p className="text-muted-foreground text-xs">
            {course.completed}/{course.total} 章节完成
            {current && ` · 当前学习: ${current.title}`}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="已完成" value={course.completed} tone="success" />
        <StatCard label="学习中" value={course.inProgress} tone="warning" />
        <StatCard label="未开始" value={course.notStarted} tone="muted" />
      </div>

      {current && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>当前学习</CardTitle>
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => onOpen(current.id)}
              className="text-sm font-medium hover:underline"
            >
              {current.id} · {current.title}
            </button>
            <p className="text-muted-foreground mt-1 text-xs">
              点击继续阅读讲义与源码导读
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>章节</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>难度</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>分数</TableHead>
              <TableHead>尝试</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {course.chapters.map((chapter) => (
              <ChapterRow key={chapter.id} chapter={chapter} onOpen={onOpen} />
            ))}
          </TableBody>
        </Table>
      </Card>

      {course.missing.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>内容不完整</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground space-y-1 text-xs">
              {course.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "success" | "warning" | "muted"
}) {
  const tones = {
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    muted: "text-muted-foreground",
  }
  return (
    <Card>
      <CardContent className="space-y-1">
        <p className={cn("text-2xl font-medium", tones[tone])}>{value}</p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </CardContent>
    </Card>
  )
}

function ChapterRow({
  chapter,
  onOpen,
}: {
  chapter: Chapter
  onOpen: (id: string) => void
}) {
  const view = STATUS_VIEW[chapter.progress.status] ?? STATUS_VIEW.not_started
  const Icon = view.icon
  return (
    <TableRow className="cursor-pointer" onClick={() => onOpen(chapter.id)}>
      <TableCell className="font-mono text-xs">{chapter.num}</TableCell>
      <TableCell>
        <span className="font-medium hover:underline">{chapter.title}</span>
      </TableCell>
      <TableCell>
        <Badge variant={DIFFICULTY_VARIANT[chapter.difficulty] ?? "outline"}>
          {chapter.difficulty}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={view.variant}>
          <Icon className="size-3" />
          {view.label}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {chapter.progress.status === "completed"
          ? `${(chapter.progress.score ?? 0).toFixed(1)}%`
          : "-"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {chapter.progress.attempts ?? 0}
      </TableCell>
    </TableRow>
  )
}

function ChapterDetail({
  chapter,
  content,
  loading,
  onBack,
}: {
  chapter: Chapter
  content: ChapterContent | null
  loading: boolean
  onBack: () => void
}) {
  const view = STATUS_VIEW[chapter.progress.status] ?? STATUS_VIEW.not_started
  const Icon = view.icon
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground inline-flex items-center gap-1.5 text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        返回课程总览
      </button>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium">{chapter.title}</h1>
          <Badge variant={view.variant}>
            <Icon className="size-3" />
            {view.label}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {chapter.id} · 难度 {chapter.difficulty}
          {chapter.progress.status === "completed" &&
            ` · 分数 ${(chapter.progress.score ?? 0).toFixed(1)}%`}
        </p>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-8">
          <section className="space-y-2">
            <h2 className="text-muted-foreground flex items-center gap-2 border-b pb-2 text-sm font-medium">
              <BookOpen className="size-4" />
              讲义 Lecture
            </h2>
            {content?.lecture ? (
              <MarkdownView content={content.lecture} />
            ) : (
              <EmptySection />
            )}
          </section>
          <section className="space-y-2">
            <h2 className="text-muted-foreground flex items-center gap-2 border-b pb-2 text-sm font-medium">
              <Code2 className="size-4" />
              源码导读 Source
            </h2>
            {content?.source ? (
              <MarkdownView content={content.source} />
            ) : (
              <EmptySection />
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function EmptySection() {
  return (
    <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
      <FileQuestion className="size-4" />
      该内容尚未生成
    </p>
  )
}
