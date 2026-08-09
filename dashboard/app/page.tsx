"use client"

import { useCallback, useEffect, useState } from "react"
import { LoaderCircle, Moon, Sun } from "lucide-react"

import { ChapterPage } from "@/components/dashboard/chapter-page"
import { STATUS_VIEW } from "@/components/dashboard/status"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  BASE_PATH,
  chapterIdFromPath,
  loadCourse,
  type Chapter,
  type Course,
} from "@/lib/prom"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

const DIFFICULTY_VARIANT: Record<
  string,
  "success" | "warning" | "destructive"
> = {
  easy: "success",
  mid: "warning",
  hard: "destructive",
}

export default function Page() {
  const [course, setCourse] = useState<Course | null>(null)
  const [ready, setReady] = useState(false)
  const [chapterId, setChapterId] = useState<string | null>(null)

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
    setChapterId(chapterIdFromPath(window.location.pathname))
  }, [])

  const openChapter = useCallback((id: string) => {
    window.location.href = `${BASE_PATH}/chapters/${id}/`
  }, [])

  if (!ready) {
    return <Loading />
  }
  if (!course || !course.found) {
    return <EmptyState />
  }

  return (
    <main className={cn("mx-auto p-6", chapterId ? "max-w-5xl" : "max-w-4xl")}>
      {chapterId ? (
        <ChapterPage chapterId={chapterId} />
      ) : (
        <Overview course={course} onOpen={openChapter} />
      )}
    </main>
  )
}

function Loading() {
  return (
    <main className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">
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
  const theme = useTheme()
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-medium">{course.name}</h1>
        <p className="text-sm text-muted-foreground">{course.language}</p>
        <Button
          className="ml-auto"
          variant="outline"
          size="icon"
          onClick={() => {
            theme.theme == "dark"
              ? theme.setTheme("light")
              : theme.setTheme("dark")
          }}
        >
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </header>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm">总体进度</span>
            <span className="text-sm font-medium">
              {course.percent.toFixed(1)}%
            </span>
          </div>
          <Progress value={course.percent} />
          <p className="text-xs text-muted-foreground">
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
            <ul className="space-y-1 text-xs text-muted-foreground">
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
        <p className="text-xs text-muted-foreground">{label}</p>
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
          ? `${(chapter.progress.score ?? 0).toFixed(1)}`
          : "-"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {chapter.progress.attempts ?? 0}
      </TableCell>
    </TableRow>
  )
}
