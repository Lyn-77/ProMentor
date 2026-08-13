/**
 * Panel state shared between the composer-dock trigger and the full-frame
 * overlay panel (both entries live in one bundle, so a plain module store
 * bridges them; no events, no projections).
 */

export interface DashboardState {
  readonly open: boolean
  /** Workspace root (session cwd) whose .promentor/ the panel shows; null when unresolvable. */
  readonly workspacePath: string | null
  /** Bumped on every refresh request to force a data reload. */
  readonly refreshKey: number
}

export interface DashboardStore {
  getSnapshot(): DashboardState
  subscribe(listener: () => void): () => void
  open(workspacePath: string | null): void
  close(): void
  refresh(): void
}

export function createDashboardStore(): DashboardStore {
  let state: DashboardState = { open: false, workspacePath: null, refreshKey: 0 }
  const listeners = new Set<() => void>()
  const emit = (): void => {
    for (const listener of [...listeners]) listener()
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    open: (workspacePath) => {
      state = { open: true, workspacePath, refreshKey: state.refreshKey + 1 }
      emit()
    },
    close: () => {
      state = { ...state, open: false }
      emit()
    },
    refresh: () => {
      state = { ...state, refreshKey: state.refreshKey + 1 }
      emit()
    },
  }
}
