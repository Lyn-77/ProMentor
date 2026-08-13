/**
 * Composer-dock trigger: opens the ProMentor dashboard panel for the current
 * session's workspace (the dock slot is session-scoped, so the inject face
 * receives the session id and the button resolves its cwd at click time).
 */

import { useEffect, useSyncExternalStore, useState } from 'react'
import { IconListPenOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { hasCourse } from './data.ts'
import type { DashboardState } from './store.ts'
import css from './dock.module.css'

export interface DashboardTriggerActions {
  getSnapshot(): DashboardState
  subscribe(listener: () => void): () => void
  open(): void
  close(): void
  /** Resolve the session workspace at render time (null when unresolvable). */
  getWorkspace(): string | null
}

export type DashboardTriggerProps = DashboardTriggerActions & PropsLocale<'promentor'>

/** How often the trigger re-probes the workspace for a `.promentor/` course. */
const PROBE_INTERVAL_MS = 10_000

export function DashboardTrigger({
  getSnapshot,
  subscribe,
  open,
  close,
  getWorkspace,
  t,
}: DashboardTriggerProps) {
  const state = useSyncExternalStore(subscribe, getSnapshot)
  const workspace = getWorkspace()
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    if (workspace === null) {
      setAvailable(false)
      return
    }
    let cancelled = false
    const probe = (): void => {
      hasCourse(workspace).then((ok) => {
        if (!cancelled) setAvailable(ok)
      })
    }
    probe()
    const timer = setInterval(probe, PROBE_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [workspace])

  // The trigger only exists while the session workspace holds a course, so
  // the "course not initialized" state is unreachable from the dock.
  if (available !== true) return null

  return (
    <button
      type="button"
      title={state.open ? t('dockClose') : t('dockOpen')}
      className={state.open ? css.cardActive : css.card}
      onClick={() => {
        if (state.open) close()
        else open()
      }}
    >
      <span className={css.lead} aria-hidden>
        <IconListPenOutline16 />
      </span>
      <span className={css.label}>{t('dockLabel')}</span>
    </button>
  )
}
