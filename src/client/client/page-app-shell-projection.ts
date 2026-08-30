/**
 * Pure controller-snapshot projection shared by the Native and rc.2 shells.
 * @module @deepseek-ai/dsh-client-ui-page-app-manager/client/page-app-shell-projection
 */

import type { PageAppClientSnapshot } from './controller.ts'
import type { PageAppRailInjected } from './PageAppRail.tsx'

/** Render data both shell variants derive from one controller snapshot. */
export interface PageAppShellProjection {
  /** Visited managed pages that remain eligible and therefore stay mounted. */
  readonly mountedIds: readonly string[]
  /** Managed pages whose surface crashed and should show recovery controls. */
  readonly failedIds: ReadonlySet<string>
  /** Permanent rail rows and selection callback. */
  readonly railInjected: PageAppRailInjected
}

/**
 * Project a controller snapshot into the rail and keep-mounted managed pages.
 * @param snapshot - Current controller state.
 * @param select - Controller selection action.
 * @returns The presentation-only shell projection.
 */
export function projectPageAppShell(
  snapshot: PageAppClientSnapshot,
  select: (pageId: string | null) => void,
): PageAppShellProjection {
  const eligibleIds = new Set(snapshot.eligible.keys())
  return {
    mountedIds: snapshot.visitedPageIds.filter(id => eligibleIds.has(id)),
    failedIds: new Set(snapshot.failedPageIds),
    railInjected: {
      rows: snapshot.registry === null
        ? []
        : snapshot.registry.entries
          .filter(row => row.enabled && !row.hidden && eligibleIds.has(row.page.id))
          .map(row => ({
            pageId: row.page.id,
            label: row.page.name,
            order: row.order,
          }))
          .sort((a, b) => a.order - b.order),
      activePageId: snapshot.activePageId,
      select,
    },
  }
}
