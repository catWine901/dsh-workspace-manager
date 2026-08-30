import type { ReactNode } from 'react'

/** Stable Workspace Manager <-> DSH contract. Host-private types never cross this file. */
export const WORKSPACE_HOST_BRIDGE_VERSION = 1 as const
export const WORKSPACE_HOST_ADAPTER_SERVICE = 'workspaceHostAdapter' as const

export type RootIntegrationMode = 'public-root-shell-seam' | 'layout-replacement'

export type WorkspaceHostCapability =
  | 'native-surface'
  | 'navigation'
  | 'panels'
  | 'host-events'
  | 'page-app-remote'
  | 'bundle-composition'

export interface WorkspaceHostDescriptor {
  readonly hostName: 'dsh'
  readonly hostVersion: string
  readonly adapterId: string
  readonly adapterVersion: string
  readonly bridgeVersion: typeof WORKSPACE_HOST_BRIDGE_VERSION
  readonly integrationMode: RootIntegrationMode
  readonly capabilities: readonly WorkspaceHostCapability[]
}

export interface HostLocation {
  readonly sessionId?: string
}

export interface HostPanelRequest {
  readonly panel: 'sidebar' | 'details'
  readonly action: 'toggle' | 'open' | 'close'
}

export type HostEvent = 'navigation-changed' | 'commands-changed' | 'settings-changed'
export type HostEventListener = (payload: unknown) => void
export type Unsubscribe = () => void

/** Render-only bridge consumed by the WorkspaceRootShell. */
export interface WorkspaceHostBridge {
  readonly descriptor: WorkspaceHostDescriptor
  readonly capabilities: ReadonlySet<WorkspaceHostCapability>
  renderNativeSurface(): ReactNode
  renderFeatureSurface(pageId: string): ReactNode
  navigate(to: HostLocation): Promise<void>
  openPanel(request: HostPanelRequest): Promise<void>
  subscribe(event: HostEvent, listener: HostEventListener): Unsubscribe
  dispose(): Promise<void>
}

export interface HostContribution {
  readonly options: {
    readonly key?: string
    readonly registrant?: string
    readonly [name: string]: unknown
  }
  readonly [name: string]: unknown
}

export interface HostContributionLedger {
  entries(key: string): readonly HostContribution[]
  subscribe(key: string, listener: () => void): Unsubscribe
  onMutate(listener: (key: string) => void): Unsubscribe
}

export interface HostAdapterAuditRecord {
  readonly detectedHostVersion: string
  readonly selectedAdapterId: string
  readonly adapterVersion: string
  readonly integrationMode: RootIntegrationMode
  readonly capabilityChecks: Readonly<Record<WorkspaceHostCapability, boolean>>
}

export function auditHostDescriptor(descriptor: WorkspaceHostDescriptor): HostAdapterAuditRecord {
  const present = new Set(descriptor.capabilities)
  const names: readonly WorkspaceHostCapability[] = [
    'native-surface', 'navigation', 'panels', 'host-events', 'page-app-remote', 'bundle-composition',
  ]
  return Object.freeze({
    detectedHostVersion: descriptor.hostVersion,
    selectedAdapterId: descriptor.adapterId,
    adapterVersion: descriptor.adapterVersion,
    integrationMode: descriptor.integrationMode,
    capabilityChecks: Object.freeze(Object.fromEntries(names.map(name => [name, present.has(name)])) as Record<WorkspaceHostCapability, boolean>),
  })
}
