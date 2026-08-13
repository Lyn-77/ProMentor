/**
 * Full-frame ProMentor dashboard panel (shell.overlay entry): course
 * overview, per-chapter lecture/source reading, and progress at a glance.
 * The panel is rendered by the root-scoped overlay slot while the shared
 * store says it is open.
 */

import { useEffect, useSyncExternalStore, useState, type ReactNode } from 'react'
import {
  Button,
  IconChevronLeftOutline14,
  IconCloseOutline16,
  IconCodeOutline16,
  IconListPenOutline16,
  IconRefreshOutline16,
  MarkdownText,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  loadChapterContent,
  loadCourse,
  type Chapter,
  type ChapterContent,
  type ChapterStatus,
  type Course,
} from './data.ts'
import type { DashboardState } from './store.ts'
import type { PromentorKey } from './locales.ts'
import css from './panel.module.css'

export interface DashboardPanelActions {
  getSnapshot(): DashboardState
  subscribe(listener: () => void): () => void
  close(): void
  refresh(): void
}

export type DashboardPanelProps = DashboardPanelActions & PropsLocale<'promentor'>

export function DashboardPanel({ getSnapshot, subscribe, close, refresh, t }: DashboardPanelProps) {
  const state = useSyncExternalStore(subscribe, getSnapshot)
  const workspace = state.workspacePath
  const [course, setCourse] = useState<Course | null>(null)
  const [ready, setReady] = useState(false)
  const [chapterId, setChapterId] = useState<string | null>(null)

  useEffect(() => {
    if (!state.open || workspace === null) return
    let cancelled = false
    setReady(false)
    setCourse(null)
    setChapterId(null)
    loadCourse(workspace)
      .then((loaded) => {
        if (!cancelled) setCourse(loaded)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [state.open, workspace, state.refreshKey])

  if (!state.open) return null

  return (
    <div className={css.overlay}>
      <div className={css.panel}>
        <header className={css.header}>
          <span className={css.title}>{t('title')}</span>
          <div className={css.headerActions}>
            <Button size="sm" variant="ghost" icon={<IconRefreshOutline16 />} onClick={refresh}>
              {t('refresh')}
            </Button>
            <Button size="sm" variant="ghost" icon={<IconCloseOutline16 />} onClick={close} />
          </div>
        </header>
        <div className={css.body}>
          {workspace === null ? (
            <Note>{t('noWorkspace')}</Note>
          ) : !ready ? (
            <Note>{t('loading')}</Note>
          ) : !course?.found ? (
            <Note>
              <strong>{t('noCourse')}</strong>
              <p>{t('noCourseHint')}</p>
            </Note>
          ) : chapterId !== null ? (
            <ChapterView workspace={workspace} chapterId={chapterId} onBack={() => setChapterId(null)} t={t} />
          ) : (
            <Overview course={course} onOpen={id => setChapterId(id)} t={t} />
          )}
        </div>
      </div>
    </div>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <div className={css.note}>{children}</div>
}

function Overview({
  course,
  onOpen,
  t,
}: {
  course: Course
  onOpen: (id: string) => void
  t: (key: PromentorKey) => string
}) {
  return (
    <div className={css.overview}>
      <div className={css.overviewHeader}>
        <h1 className={css.courseName}>{course.name}</h1>
        <span className={css.language}>{course.language}</span>
      </div>

      <div className={css.card}>
        <div className={css.progressRow}>
          <span>{t('overall')}</span>
          <span className={css.percent}>{course.percent.toFixed(1)}%</span>
        </div>
        <div className={css.progressBar}>
          <div className={css.progressFill} style={{ width: `${course.percent}%` }} />
        </div>
        <p className={css.hint}>
          {course.completed}/{course.total} {t('chaptersDone')}
          {course.current && ` · ${t('currentLearning')}: ${course.current.title}`}
        </p>
      </div>

      <div className={css.stats}>
        <Stat value={course.completed} label={t('done')} tone="ok" />
        <Stat value={course.inProgress} label={t('learning')} tone="warn" />
        <Stat value={course.notStarted} label={t('notStarted')} tone="muted" />
      </div>

      <div className={css.card}>
        <table className={css.table}>
          <thead>
            <tr>
              <th>{t('chapter')}</th>
              <th>{t('titleCol')}</th>
              <th>{t('difficulty')}</th>
              <th>{t('status')}</th>
              <th>{t('score')}</th>
              <th>{t('attempts')}</th>
            </tr>
          </thead>
          <tbody>
            {course.chapters.map(chapter => (
              <tr key={chapter.id} className={css.chapterRow} onClick={() => onOpen(chapter.id)}>
                <td className={css.mono}>{chapter.num}</td>
                <td>
                  <span className={css.chapterTitle}>{chapter.title}</span>
                </td>
                <td>
                  <DifficultyBadge difficulty={chapter.difficulty} />
                </td>
                <td>
                  <StatusBadge status={chapter.progress.status} t={t} />
                </td>
                <td className={css.dim}>
                  {chapter.progress.status === 'completed'
                    ? (chapter.progress.score ?? 0).toFixed(1)
                    : '-'}
                </td>
                <td className={css.dim}>{chapter.progress.attempts ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {course.missing.length > 0 && (
        <div className={`${css.card} ${css.missing}`}>
          <h3>{t('missingFiles')}</h3>
          <ul>
            {course.missing.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Stat({ value, label, tone }: { value: number; label: string; tone: 'ok' | 'warn' | 'muted' }) {
  const tones = { ok: css.toneOk, warn: css.toneWarn, muted: css.toneMuted }
  return (
    <div className={css.card}>
      <p className={`${css.statValue} ${tones[tone]}`}>{value}</p>
      <p className={css.statLabel}>{label}</p>
    </div>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const tone =
    difficulty === 'easy' ? css.badgeOk : difficulty === 'hard' ? css.badgeDanger : css.badgeWarn
  return <span className={`${css.badge} ${tone}`}>{difficulty}</span>
}

const STATUS_LABEL: Record<ChapterStatus, PromentorKey> = {
  completed: 'done',
  in_progress: 'learning',
  not_started: 'notStarted',
}

function StatusBadge({ status, t }: { status: ChapterStatus; t: (key: PromentorKey) => string }) {
  const tone =
    status === 'completed' ? css.badgeOk : status === 'in_progress' ? css.badgeWarn : css.badgeMuted
  return <span className={`${css.badge} ${tone}`}>{t(STATUS_LABEL[status])}</span>
}

type ChapterTab = 'lecture' | 'source'

function ChapterView({
  workspace,
  chapterId,
  onBack,
  t,
}: {
  workspace: string
  chapterId: string
  onBack: () => void
  t: (key: PromentorKey) => string
}) {
  const [content, setContent] = useState<ChapterContent | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [tab, setTab] = useState<ChapterTab>('lecture')

  useEffect(() => {
    let cancelled = false
    setContent(null)
    setChapter(null)
    setTab('lecture')
    Promise.all([
      loadChapterContent(workspace, chapterId),
      loadCourse(workspace),
    ]).then(([loaded, course]) => {
      if (cancelled) return
      setContent(loaded)
      setChapter(course.chapters.find(ch => ch.id === chapterId) ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [workspace, chapterId])

  const tabs: { id: ChapterTab; label: string; icon: ReactNode }[] = [
    { id: 'lecture', label: t('lecture'), icon: <IconListPenOutline16 /> },
    { id: 'source', label: t('source'), icon: <IconCodeOutline16 /> },
  ]
  const body = content?.[tab]

  return (
    <div className={css.chapter}>
      <aside className={css.chapterAside}>
        <button type="button" className={css.backLink} onClick={onBack}>
          <IconChevronLeftOutline14 />
          {t('back')}
        </button>
        {chapter && (
          <div className={css.chapterMeta}>
            <p className={css.chapterName}>{chapter.title}</p>
            <p className={css.chapterId}>
              {chapter.id} · {t('difficulty')} {chapter.difficulty}
            </p>
            <StatusBadge status={chapter.progress.status} t={t} />
          </div>
        )}
        <nav className={css.tabs}>
          {tabs.map(item => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? `${css.tab} ${css.tabActive}` : css.tab}
              onClick={() => setTab(item.id)}
            >
              <span className={css.tabIcon} aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className={css.chapterMain}>
        {content === null ? (
          <Note>{t('loading')}</Note>
        ) : body ? (
          <MarkdownText text={body} />
        ) : (
          <Note>
            {t(tab === 'lecture' ? 'lecture' : 'source')} {t('notGenerated')}
          </Note>
        )}
      </div>
    </div>
  )
}
