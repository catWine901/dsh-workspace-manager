/**
 * The keep-mounted Workspace App shell, registered into the built-in `root`
 * seat (spec §3/§4). Layout: permanent far-left rail (PageAppRail) plus the
 * Surface Host. The built-in Original DSH seat (`page-app.shell.builtin`) is
 * mounted unconditionally and hidden (never unmounted) while a managed surface
 * is active; each visited managed surface mounts on first visit and stays
 * mounted (HTML `hidden` toggle only) so editor/draft/scroll state survives
 * switching. Disable/uninstall eviction is a controller decision: the shell
 * only ever renders ids the controller's snapshot reports as visited+eligible.
 * Pure component: the controller arrives through the inject hooks compartment
 * (`usePageApp`), and child surfaces render through the props renderSlot face.
 * @module @deepseek-ai/dsh-client-ui-page-app-manager/client/PageAppShell
 */

import { useMemo, type ReactNode } from 'react'
import type {
  InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { PageAppClientSnapshot } from './controller.ts'
import type { PageAppObservable } from './stores.ts'
import { PageAppRail } from './PageAppRail.tsx'
import { PageAppFailureSurface } from './PageAppFailureSurface.tsx'
import { projectPageAppShell } from './page-app-shell-projection.ts'
import css from './PageAppShell.module.css'

/** The controller face the manager apply() hands to the shell registration. */
export interface PageAppShellInjected {
  /** Bare controller observable bound to `usePageApp` by the renderer. */
  hooks: { pageApp: PageAppObservable<PageAppClientSnapshot> }
  /** Select one page (null = built-in DSH). */
  select: (pageId: string | null) => void
  /** Uninstall one managed page (failure-surface action). */
  uninstall: (pageId: string) => void
}

/** Full composed props: runtime share + child-slot render share + locale seat + inject face. */
export type PageAppShellProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<'page-app.shell.builtin' | 'page-app.shell.surface'>
  & PropsLocale<'settings.pageApp'>
  & InjectFace<PageAppShellInjected>

/** Stable per-page wrapper keyed by page id (keeps local React state across visits). */
function SurfaceFrame(props: { pageId: string; hidden: boolean; children: ReactNode }) {
  return (
    <section
      className={css.surface}
      data-page-id={props.pageId}
      hidden={props.hidden || undefined}
    >
      {props.children}
    </section>
  )
}

/** The root Workspace App shell (see module doc). */
export function PageAppShell({ usePageApp, select, uninstall, t, renderSlot }: PageAppShellProps) {
  return (
    <PageAppShellView
      usePageApp={usePageApp}
      select={select}
      uninstall={uninstall}
      t={t}
      nativeSurface={renderSlot('page-app.shell.builtin', {})}
      renderSurface={pageId => renderSlot('page-app.shell.surface', {}, { entryKey: pageId })}
    />
  )
}

/** Common full-window layout for native child-seat and RC2 wrapper integrations. */
export interface PageAppShellViewProps extends Pick<PageAppShellProps, 'usePageApp' | 'select' | 'uninstall' | 't'> {
  /** Host-rendered original DSH element, never copied or reconstructed by the Manager. */
  nativeSurface: ReactNode
  /** Render a managed page through the registering plugin's authorized slot binding. */
  renderSurface: (pageId: string) => ReactNode
}

/** Permanent navigation and mutually exclusive, keep-mounted full-page surfaces. */
export function PageAppShellView({ usePageApp, select, uninstall, t, nativeSurface, renderSurface }: PageAppShellViewProps) {
  const snapshot = usePageApp((state: PageAppClientSnapshot) => state)
  const activePageId = snapshot.activePageId
  const { mountedIds, failedIds, railInjected } = useMemo(
    () => projectPageAppShell(snapshot, select),
    [snapshot, select],
  )

  return (
    <div className={css.shell} data-page-app-shell>
      <PageAppRail {...railInjected} variant="full" />
      <main className={css.host}>
        {/* Original DSH: always mounted, hidden only while a managed page is active. */}
        <SurfaceFrame pageId="dsh" hidden={activePageId !== null}>
          {nativeSurface}
        </SurfaceFrame>
        {mountedIds.map(pageId => (
          <SurfaceFrame key={pageId} pageId={pageId} hidden={activePageId !== pageId}>
            {failedIds.has(pageId)
              ? (
                <PageAppFailureSurface
                  pageId={pageId}
                  t={t}
                  onRetry={() => { select(pageId) }}
                  onUninstall={() => { uninstall(pageId) }}
                />
              )
              : renderSurface(pageId)}
          </SurfaceFrame>
        ))}
      </main>
    </div>
  )
}
