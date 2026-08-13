/**
 * ProMentor dashboard data layer.
 *
 * All reads go through the host gateway route `/promentor/data` (see
 * @deepseek-ai/dsh-host-promentor), which confines every request to the
 * requested workspace's `.promentor/` directory.
 */

export type ChapterStatus = 'not_started' | 'in_progress' | 'completed'

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

const DATA_URL = '/promentor/data'

function dataUrl(workspace: string, path: string): string {
  return `${DATA_URL}?ws=${encodeURIComponent(workspace)}&p=${encodeURIComponent(path)}`
}

async function getJson<T>(workspace: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(dataUrl(workspace, path))
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function getText(workspace: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(dataUrl(workspace, path))
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function hasFile(workspace: string, path: string): Promise<boolean> {
  try {
    const res = await fetch(dataUrl(workspace, path), { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Whether the workspace holds a course — the same predicate `loadCourse`
 * uses for `found` (course.json or progress.json present). Used by the dock
 * trigger to only surface the button for initialized workspaces.
 */
export async function hasCourse(workspace: string): Promise<boolean> {
  const [course, progress] = await Promise.all([
    hasFile(workspace, 'course.json'),
    hasFile(workspace, 'progress.json'),
  ])
  return course || progress
}

const REQUIRED_FILES: Record<keyof ChapterFiles, string> = {
  lecture: 'lecture.md',
  source: 'source.md',
  lab: 'lab.json',
}

function fallbackTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function parseChapter(meta: ChapterMeta, progress: ProgressJson): Chapter {
  const prog = progress.chapters?.[meta.id] ?? { status: 'not_started' as ChapterStatus }
  const match = meta.id.match(/^(ch\d+)-(.*)$/)
  const num = match?.[1] ?? meta.id
  const slug = match?.[2] ?? meta.id
  return {
    ...meta,
    num,
    slug,
    title: meta.title || fallbackTitle(slug),
    difficulty: meta.difficulty || '-',
    progress: prog,
    files: { lecture: false, source: false, lab: false },
  }
}

export async function loadCourse(workspace: string): Promise<Course> {
  const [courseJson, progressJson] = await Promise.all([
    getJson<CourseJson>(workspace, 'course.json'),
    getJson<ProgressJson>(workspace, 'progress.json'),
  ])

  const course = courseJson ?? {}
  const progress = progressJson ?? {}
  const metas = course.chapters ?? []

  const chapters = await Promise.all(
    metas.map(async (meta) => {
      const chapter = parseChapter(meta, progress)
      const [lecture, source, lab] = await Promise.all([
        hasFile(workspace, `chapters/${chapter.id}/${REQUIRED_FILES.lecture}`),
        hasFile(workspace, `chapters/${chapter.id}/${REQUIRED_FILES.source}`),
        hasFile(workspace, `chapters/${chapter.id}/${REQUIRED_FILES.lab}`),
      ])
      chapter.files = { lecture, source, lab }
      return chapter
    }),
  )

  const currentId = progress.current_chapter ?? null
  const current =
    chapters.find(ch => ch.id === currentId) ??
    chapters.find(ch => ch.progress.status === 'in_progress') ??
    null

  const completed = chapters.filter(ch => ch.progress.status === 'completed').length
  const inProgress = chapters.filter(ch => ch.progress.status === 'in_progress').length
  const notStarted = chapters.filter(ch => ch.progress.status === 'not_started').length
  const total = chapters.length
  const percent = total ? (completed / total) * 100 : 0

  const missing = chapters.flatMap(ch =>
    Object.keys(REQUIRED_FILES)
      .filter(name => !ch.files[name as keyof ChapterFiles])
      .map(name => `${ch.id} 缺 ${name}`),
  )

  return {
    name: course.project || progress.project_name || 'ProMentor Course',
    language: course.language || '-',
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

export async function loadChapterContent(workspace: string, id: string): Promise<ChapterContent> {
  const [lecture, source] = await Promise.all([
    getText(workspace, `chapters/${id}/lecture.md`),
    getText(workspace, `chapters/${id}/source.md`),
  ])
  return { lecture, source }
}
