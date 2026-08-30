import { useMemo, type ReactNode } from 'react'
import type { WorkspaceHostBridge } from '../host-bridge/index.ts'
import type { PageAppClientSnapshot } from '../client/client/controller.ts'
import type { PageAppSettingsKey, Translate } from '../client/client/locales.ts'
import { PageAppRail } from '../client/client/PageAppRail.tsx'
import { PageAppFailureSurface } from '../client/client/PageAppFailureSurface.tsx'
import { projectPageAppShell } from '../client/client/page-app-shell-projection.ts'
import css from '../client/client/PageAppShell.module.css'

export interface WorkspaceRootShellProps {
  readonly hostBridge: WorkspaceHostBridge
  readonly usePageApp: <T>(selector: (snapshot: PageAppClientSnapshot) => T) => T
  readonly select: (pageId: string | null) => void
  readonly uninstall: (pageId: string) => void
  readonly t: Translate<PageAppSettingsKey>
}

function SurfaceFrame(props: { pageId: string; hidden: boolean; children: ReactNode }) {
  return <section className={css.surface} data-page-id={props.pageId} hidden={props.hidden || undefined}>{props.children}</section>
}

/** The only outer shell. Native DSH is rendered as a real child of its content region. */
export function WorkspaceRootShell({ hostBridge, usePageApp, select, uninstall, t }: WorkspaceRootShellProps) {
  const snapshot = usePageApp((state: PageAppClientSnapshot) => state)
  const activePageId = snapshot.activePageId
  const { mountedIds, failedIds, railInjected } = useMemo(
    () => projectPageAppShell(snapshot, select),
    [snapshot, select],
  )

  return (
    <div className={css.shell} data-workspace-root-shell data-host-adapter={hostBridge.descriptor.adapterId}>
      <PageAppRail {...railInjected} variant="full" />
      <main className={css.host} data-workspace-content-region>
        <SurfaceFrame pageId="dsh" hidden={activePageId !== null}>
          <div data-native-dsh-surface>{hostBridge.renderNativeSurface()}</div>
        </SurfaceFrame>
        {mountedIds.map(pageId => (
          <SurfaceFrame key={pageId} pageId={pageId} hidden={activePageId !== pageId}>
            {failedIds.has(pageId)
              ? <PageAppFailureSurface pageId={pageId} t={t} onRetry={() => { select(pageId) }} onUninstall={() => { uninstall(pageId) }} />
              : hostBridge.renderFeatureSurface(pageId)}
          </SurfaceFrame>
        ))}
      </main>
    </div>
  )
}
