/**
 * ProMentor dashboard browser plugin: a composer-dock trigger (per-session
 * workspace) plus a full-frame dashboard panel over the shell overlay.
 */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { DashboardTrigger, type DashboardTriggerActions } from './dock.tsx'
import { DashboardPanel, type DashboardPanelActions } from './panel.tsx'
import { createDashboardStore } from './store.ts'
import { en, zh, type PromentorKey } from './locales.ts'

export { DashboardPanel } from './panel.tsx'
export { DashboardTrigger } from './dock.tsx'
export type { DashboardPanelActions, DashboardPanelProps } from './panel.tsx'
export type { DashboardTriggerActions, DashboardTriggerProps } from './dock.tsx'
export type { PromentorKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** ProMentor dashboard copy. */
    promentor: PromentorKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'promentor'

/** Services required by the dock trigger, the overlay panel, and the locale registration. */
export const inject = ['slots', 'locale', 'sessions']

export function apply(ctx: ClientContext): void {
  const store = createDashboardStore()

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-promentor: dictionaries')

  const triggerActions = (sessionId: SessionId): DashboardTriggerActions => ({
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    open: () => {
      const summary = ctx.sessions.list.getSnapshot().byId[sessionId]
      store.open(summary?.cwd ?? null)
    },
    close: () => store.close(),
    getWorkspace: () => ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd ?? null,
  })

  const panelActions = (): DashboardPanelActions => ({
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    close: () => store.close(),
    refresh: () => store.refresh(),
  })

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'promentor',
    order: 20,
    locale: NS,
    inject: triggerActions,
  }, DashboardTrigger))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'promentor',
    order: 10,
    locale: NS,
    inject: panelActions,
  }, DashboardPanel))
}
