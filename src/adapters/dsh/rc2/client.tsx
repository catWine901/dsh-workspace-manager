import { useMemo, type ReactNode } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime, PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {
  HostEvent, HostEventListener, HostLocation, HostPanelRequest, Unsubscribe,
  WorkspaceHostBridge, WorkspaceHostDescriptor,
} from '../../../host-bridge/index.ts'
import { WorkspaceRootShell } from '../../../core/WorkspaceRootShell.tsx'
import type { PageAppController } from '../../../client/client/controller.ts'
import type { PageAppShellInjected } from '../../../client/client/PageAppShell.tsx'
import { shellInjected, NS, type PageAppShellDisposer } from '../../../client/client/shell-registration.ts'
import { Rc2NativeDshSurface, createRc2LayoutStore } from './Rc2NativeDshSurface.tsx'

class Rc2LayoutController {
  private panels: Rc2RootProps['actions'] | undefined

  public attachPanels(actions: Rc2RootProps['actions']): void { this.panels = actions }
  public toggleSidebar(): void { this.requirePanels().toggleSidebar() }
  public openDetails(): void { this.requirePanels().openDetails() }
  public closeDetails(): void { this.requirePanels().closeDetails() }

  private requirePanels(): Rc2RootProps['actions'] {
    if (this.panels === undefined) throw new Error('RC2 Host Adapter: layout actions are not mounted')
    return this.panels
  }
}

interface Rc2Sessions {
  readonly list: { getSnapshot(): unknown; subscribe(listener: () => void): Unsubscribe }
  open(sessionId: string): void
  clear(): void
}

interface Rc2RemoteEvents {
  $on(event: string, listener: (...args: unknown[]) => void): Unsubscribe
}

class Rc2WorkspaceHostRuntime {
  private readonly subscriptions = new Set<Unsubscribe>()
  private disposed = false

  public constructor(
    private readonly ctx: ClientContext,
    public readonly descriptor: WorkspaceHostDescriptor,
  ) {}

  public bridge(renderNativeSurface: () => ReactNode, renderFeatureSurface: (pageId: string) => ReactNode): WorkspaceHostBridge {
    return {
      descriptor: this.descriptor,
      capabilities: new Set(this.descriptor.capabilities),
      renderNativeSurface,
      renderFeatureSurface,
      navigate: location => this.navigate(location),
      openPanel: request => this.openPanel(request),
      subscribe: (event, listener) => this.subscribe(event, listener),
      dispose: () => this.dispose(),
    }
  }

  private async navigate(location: HostLocation): Promise<void> {
    this.assertLive()
    const sessions = this.ctx.get('sessions') as Rc2Sessions | undefined
    if (sessions === undefined) throw new Error('RC2 Host Adapter: sessions service is unavailable')
    if (location.sessionId === undefined) sessions.clear()
    else sessions.open(location.sessionId)
  }

  private async openPanel(request: HostPanelRequest): Promise<void> {
    this.assertLive()
    const layout = this.ctx.get('layout') as Rc2LayoutController | undefined
    if (layout === undefined) throw new Error('RC2 Host Adapter: layout service is unavailable')
    if (request.panel === 'sidebar' && request.action === 'toggle') layout.toggleSidebar()
    else if (request.panel === 'details' && request.action === 'open') layout.openDetails()
    else if (request.panel === 'details' && request.action === 'close') layout.closeDetails()
    else throw new Error(`RC2 Host Adapter: unsupported panel transition ${request.panel}/${request.action}`)
  }

  private subscribe(event: HostEvent, listener: HostEventListener): Unsubscribe {
    this.assertLive()
    let off: Unsubscribe
    if (event === 'navigation-changed') {
      const sessions = this.ctx.get('sessions') as Rc2Sessions | undefined
      if (sessions === undefined) throw new Error('RC2 Host Adapter: sessions service is unavailable')
      off = sessions.list.subscribe(() => { listener(sessions.list.getSnapshot()) })
    } else {
      const remote = this.ctx.get('remote') as Rc2RemoteEvents | undefined
      if (remote === undefined) throw new Error('RC2 Host Adapter: Remote event carrier is unavailable')
      const rc2Event = event === 'commands-changed' ? 'commands/change' : 'settings/document-updated'
      off = remote.$on(rc2Event, (...args) => { listener(args) })
    }
    let active = true
    const tracked = () => {
      if (!active) return
      active = false
      this.subscriptions.delete(tracked)
      off()
    }
    this.subscriptions.add(tracked)
    return tracked
  }

  public async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    for (const off of [...this.subscriptions].reverse()) off()
  }

  private assertLive(): void {
    if (this.disposed) throw new Error('RC2 Host Adapter: bridge is disposed')
  }
}

type Rc2RootProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay' | 'page-app.shell.surface'>
  & PropsStore<ReturnType<typeof createRc2LayoutStore>>
  & PropsLocale<'settings.pageApp'>
  & InjectFace<PageAppShellInjected & { hostRuntime: Rc2WorkspaceHostRuntime }>

function Rc2WorkspaceRoot(props: Rc2RootProps) {
  const bridge = useMemo(() => props.hostRuntime.bridge(
    () => <Rc2NativeDshSurface useStore={props.useStore} useSessions={props.useSessions} actions={props.actions} renderSlot={props.renderSlot} />,
    pageId => props.renderSlot('page-app.shell.surface', {}, { entryKey: pageId }),
  ), [props.actions, props.hostRuntime, props.renderSlot, props.useSessions, props.useStore])
  return <WorkspaceRootShell hostBridge={bridge} usePageApp={props.usePageApp} select={props.select} uninstall={props.uninstall} t={props.t} />
}

/** Register the RC2 layout-replacement root and the native layout service face. */
export function registerRc2WorkspaceRoot(
  ctx: ClientContext,
  controller: PageAppController,
  descriptor: WorkspaceHostDescriptor,
): PageAppShellDisposer {
  const runtime = new Rc2WorkspaceHostRuntime(ctx, descriptor)
  const layout = new Rc2LayoutController()
  const disposeLayout = ctx.reflect.provide('layout', layout)
  const disposeRegistration = ctx.slots.register({
    name: 'root',
    // RC2's native ui-layout owns priority 0; the lowest priority renders.
    // A distinct value shadows it without replacing or mutating its entry.
    priority: -10,
    children: {
      'sidebar': { kind: 'single', scope: 'root' },
      'conversation': { kind: 'single', scope: 'session-maybe' },
      'details': { kind: 'single', scope: 'session' },
      'shell.overlay': { kind: 'list', scope: 'root' },
      'page-app.shell.surface': { kind: 'keyed', scope: 'root' },
    },
    store: createRc2LayoutStore,
    locale: NS,
    inject: (actions) => {
      layout.attachPanels(actions)
      return { ...shellInjected(controller), hostRuntime: runtime }
    },
  }, Rc2WorkspaceRoot)
  return () => { disposeRegistration(); void disposeLayout(); void runtime.dispose() }
}
