"use client"

import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"

import { ChapterDetail } from "@/components/dashboard/chapter-detail"
import { BASE_PATH, loadCourse, type Chapter } from "@/lib/prom"

export function ChapterPage({ chapterId }: { chapterId: string }) {
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setChapter(null)
    setNotFound(false)
    loadCourse().then((course) => {
      if (cancelled) return
      const found = course.chapters.find((ch) => ch.id === chapterId)
      if (found) {
        setChapter(found)
      } else {
        setNotFound(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [chapterId])

  if (notFound) {
    return (
      <p className="text-sm text-muted-foreground">
        未找到章节 {chapterId}，{" "}
        <a href={`${BASE_PATH}/`} className="text-foreground underline">
          返回课程总览
        </a>
      </p>
    )
  }
  if (!chapter) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        正在加载章节 …
      </p>
    )
  }

  return (
    <ChapterDetail
      chapter={chapter}
      onBack={() => {
        window.location.href = `${BASE_PATH}/`
      }}
    />
  )
}
