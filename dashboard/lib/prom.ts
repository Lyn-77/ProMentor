/**
 * ProMentor 数据层
 *
 * 产物是通用静态站点，不内嵌任何课程数据。
 * 运行时从部署根读取项目的 .promentor/（course.json / progress.json / chapters/）。
 * 部署约定：产物复制为项目根下的 dashboard/，静态服务器根为项目根。
 */

export type ChapterStatus = "not_started" | "in_progress" | "completed"

export interface ChapterMeta {
  id: string
  num: string
  slug: string
  title: string
  difficulty: string
  prerequisites?: string[]
  learning_goals?: string[]
  source_files?: string[]
}

export interface ChapterProgress {
  status: ChapterStatus
  score?: number
  attempts?: number
  completed_at?: string
}

export interface CourseJson {
  project?: string
  language?: string
  chapters?: ChapterMeta[]
}

export interface ProgressJson {
  project_name?: string
  current_chapter?: string
  chapters?: Record<string, ChapterProgress>
}

export interface ChapterFiles {
  lecture: boolean
  source: boolean
  lab: boolean
}

export interface Chapter extends ChapterMeta {
  progress: ChapterProgress
  files: ChapterFiles
}

export interface Course {
  name: string
  language: string
  found: boolean
  chapters: Chapter[]
  current: Chapter | null
  completed: number
  inProgress: number
  notStarted: number
  total: number
  percent: number
  missing: string[]
}

export interface ChapterContent {
  lecture: string | null
  source: string | null
}

// 数据根：basePath 会影响所有静态资源，public 文件挂在 /dashboard/ 前缀下。
// - 开发：课程数据放 public/prom-data，路径为 <basePath>/prom-data
// - 产物：静态服务器根=项目根，数据仍是项目根下的 .promentor/，不受 basePath 影响
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/dashboard"
const PROM_ROOT =
  process.env.NODE_ENV === "development"
    ? `${BASE_PATH}/prom-data`
    : "/.promentor"
const REQUIRED_FILES: Record<keyof ChapterFiles, string> = {
  lecture: "lecture.md",
  source: "source.md",
  lab: "lab.json",
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${PROM_ROOT}/${path}`)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function hasFile(path: string): Promise<boolean> {
  try {
    const res = await fetch(`${PROM_ROOT}/${path}`, { method: "HEAD" })
    return res.ok
  } catch {
    return false
  }
}

async function chapterFiles(id: string): Promise<ChapterFiles> {
  const entries = Object.entries(REQUIRED_FILES) as [keyof ChapterFiles, string][]
  const results = await Promise.all(
    entries.map(([, file]) => hasFile(`chapters/${id}/${file}`)),
  )
  return {
    lecture: results[0],
    source: results[1],
    lab: results[2],
  }
}

function fallbackTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function parseChapter(meta: ChapterMeta, progress: ProgressJson): Chapter {
  const prog = progress.chapters?.[meta.id] ?? { status: "not_started" as ChapterStatus }
  const match = meta.id.match(/^(ch\d+)-(.*)$/)
  const num = match?.[1] ?? meta.id
  const slug = match?.[2] ?? meta.id
  return {
    ...meta,
    num,
    slug,
    title: meta.title || fallbackTitle(slug),
    difficulty: meta.difficulty || "-",
    progress: prog,
    files: { lecture: false, source: false, lab: false },
  }
}

export async function loadCourse(): Promise<Course> {
  const [courseJson, progressJson] = await Promise.all([
    getJson<CourseJson>("course.json"),
    getJson<ProgressJson>("progress.json"),
  ])

  const course = courseJson ?? {}
  const progress = progressJson ?? {}
  const metas = course.chapters ?? []

  const chapters = await Promise.all(
    metas.map(async (meta) => {
      const chapter = parseChapter(meta, progress)
      chapter.files = await chapterFiles(chapter.id)
      return chapter
    }),
  )

  const currentId = progress.current_chapter ?? null
  const current =
    chapters.find((ch) => ch.id === currentId) ??
    chapters.find((ch) => ch.progress.status === "in_progress") ??
    null

  const completed = chapters.filter((ch) => ch.progress.status === "completed").length
  const inProgress = chapters.filter((ch) => ch.progress.status === "in_progress").length
  const notStarted = chapters.filter((ch) => ch.progress.status === "not_started").length
  const total = chapters.length
  const percent = total ? (completed / total) * 100 : 0

  const missing = chapters.flatMap((ch) =>
    Object.keys(REQUIRED_FILES)
      .filter((name) => !ch.files[name as keyof ChapterFiles])
      .map((name) => `${ch.id} 缺 ${name}`),
  )

  return {
    name: course.project || progress.project_name || "ProMentor Course",
    language: course.language || "-",
    found: Boolean(courseJson || progressJson),
    chapters,
    current,
    completed,
    inProgress,
    notStarted,
    total,
    percent,
    missing,
  }
}

async function fetchText(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${PROM_ROOT}/${path}`)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function loadChapterContent(id: string): Promise<ChapterContent> {
  const [lecture, source] = await Promise.all([
    fetchText(`chapters/${id}/lecture.md`),
    fetchText(`chapters/${id}/source.md`),
  ])
  return { lecture, source }
}
