import type { PageAppController } from './controller.ts'
import { PageAppShell, type PageAppShellInjected } from './PageAppShell.tsx'

/** Dictionary namespace owned by the Workspace Apps shell and settings tab. */
export const NS = 'settings.pageApp'

/** Dependencies shared by the native and rc.2 shell registration strategies. */
export interface PageAppShellRegistrationDeps {
  /** Controller whose observable and actions are exposed to the shell. */
  controller: PageAppController
}

/** Releases a shell registration from its slot. */
export type PageAppShellDisposer = () => void

/**
 * Build the shell's injected observable and recovery actions.
 * @param controller - Workspace Apps controller supplying observable state and actions.
 * @returns the shell's injected props face.
 */
export function shellInjected(controller: PageAppController): PageAppShellInjected {
  return {
    hooks: { pageApp: controller.observable },
    select: (pageId) => { controller.select(pageId) },
    // The failure surface's uninstall runs the same flow as Settings (no
    // cancellation UI on the shell; a fresh signal keeps the call valid).
    uninstall: (pageId) => { void controller.uninstall(pageId, new AbortController().signal) },
  }
}

export { PageAppShell }
