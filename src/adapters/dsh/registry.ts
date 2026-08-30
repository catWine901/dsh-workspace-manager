import type { WorkspaceHostDescriptor } from '../../host-bridge/index.ts'

export interface DshHostAdapterDefinition {
  readonly id: string
  readonly adapterVersion: string
  readonly hostVersions: readonly string[]
  readonly integrationMode: WorkspaceHostDescriptor['integrationMode']
  readonly requiredCapabilities: WorkspaceHostDescriptor['capabilities']
}

export const PUBLIC_ROOT_SHELL_ADAPTER = Object.freeze({
  id: 'dsh-public-root-shell-v1',
  adapterVersion: '1.0.0',
  hostVersions: Object.freeze([]),
  integrationMode: 'public-root-shell-seam',
  requiredCapabilities: Object.freeze(['native-surface', 'navigation', 'panels', 'host-events', 'page-app-remote', 'bundle-composition']),
} satisfies DshHostAdapterDefinition)

export const DSH_RC2_LAYOUT_REPLACEMENT_ADAPTER = Object.freeze({
  id: 'dsh-0.1.1-rc.2-layout-replacement',
  adapterVersion: '1.0.0',
  hostVersions: Object.freeze(['0.1.1-rc.2']),
  integrationMode: 'layout-replacement',
  requiredCapabilities: Object.freeze(['native-surface', 'navigation', 'panels', 'host-events', 'page-app-remote', 'bundle-composition']),
} satisfies DshHostAdapterDefinition)

export const DSH_HOST_ADAPTERS: readonly DshHostAdapterDefinition[] = Object.freeze([
  PUBLIC_ROOT_SHELL_ADAPTER,
  DSH_RC2_LAYOUT_REPLACEMENT_ADAPTER,
])

export class UnsupportedDshHostError extends Error {
  public constructor(
    public readonly detectedVersion: string,
    public readonly supportedVersions: readonly string[],
    reason?: string,
  ) {
    super(`Workspace Manager does not support DSH ${JSON.stringify(detectedVersion)}; supported versions: ${supportedVersions.join(', ')}${reason === undefined ? '' : `; ${reason}`}`)
    this.name = 'UnsupportedDshHostError'
  }
}

/** Deterministic, auditable selection. Public seam wins; unknown versions fail closed. */
export function selectDshHostAdapter(
  descriptor: WorkspaceHostDescriptor,
  adapters: readonly DshHostAdapterDefinition[] = DSH_HOST_ADAPTERS,
): DshHostAdapterDefinition {
  const supportedVersions = [...new Set(adapters.flatMap(adapter => adapter.hostVersions))]
  const matches = adapters.filter(adapter =>
    adapter.hostVersions.includes(descriptor.hostVersion)
    && adapter.integrationMode === descriptor.integrationMode
    && adapter.requiredCapabilities.every(capability => descriptor.capabilities.includes(capability)),
  )
  if (matches.length !== 1) {
    throw new UnsupportedDshHostError(
      descriptor.hostVersion,
      supportedVersions,
      matches.length > 1 ? `ambiguous adapter match: ${matches.map(match => match.id).join(', ')}` : 'no exact version/mode/capability match',
    )
  }
  const selected = matches[0]!
  if (selected.id !== descriptor.adapterId || selected.adapterVersion !== descriptor.adapterVersion) {
    throw new UnsupportedDshHostError(descriptor.hostVersion, supportedVersions, `host selected ${descriptor.adapterId}@${descriptor.adapterVersion}, package expected ${selected.id}@${selected.adapterVersion}`)
  }
  return selected
}
