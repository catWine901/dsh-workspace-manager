import type { ReactNode } from 'react';
export declare const WORKSPACE_HOST_BRIDGE_VERSION: 1;
export declare const WORKSPACE_HOST_ADAPTER_SERVICE: "workspaceHostAdapter";
export type RootIntegrationMode = 'public-root-shell-seam' | 'layout-replacement';
export type WorkspaceHostCapability = 'native-surface' | 'navigation' | 'panels' | 'host-events' | 'page-app-remote' | 'bundle-composition';
export interface WorkspaceHostDescriptor {
  readonly hostName: 'dsh';
  readonly hostVersion: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly bridgeVersion: 1;
  readonly integrationMode: RootIntegrationMode;
  readonly capabilities: readonly WorkspaceHostCapability[];
}
export interface HostLocation { readonly sessionId?: string; }
export interface HostPanelRequest { readonly panel: 'sidebar' | 'details'; readonly action: 'toggle' | 'open' | 'close'; }
export type HostEvent = 'navigation-changed' | 'commands-changed' | 'settings-changed';
export type HostEventListener = (payload: unknown) => void;
export type Unsubscribe = () => void;
export interface WorkspaceHostBridge {
  readonly descriptor: WorkspaceHostDescriptor;
  readonly capabilities: ReadonlySet<WorkspaceHostCapability>;
  renderNativeSurface(): ReactNode;
  renderFeatureSurface(pageId: string): ReactNode;
  navigate(to: HostLocation): Promise<void>;
  openPanel(request: HostPanelRequest): Promise<void>;
  subscribe(event: HostEvent, listener: HostEventListener): Unsubscribe;
  dispose(): Promise<void>;
}
export interface HostAdapterAuditRecord {
  readonly detectedHostVersion: string;
  readonly selectedAdapterId: string;
  readonly adapterVersion: string;
  readonly integrationMode: RootIntegrationMode;
  readonly capabilityChecks: Readonly<Record<WorkspaceHostCapability, boolean>>;
}
export declare function auditHostDescriptor(descriptor: WorkspaceHostDescriptor): HostAdapterAuditRecord;
