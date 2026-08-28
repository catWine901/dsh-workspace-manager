import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PageAppController } from './controller.ts'
import { Rc2PageAppShell } from './Rc2PageAppShell.tsx'
import { NS, shellInjected, type PageAppShellDisposer } from './shell-registration.ts'

/**
 * Register the public rc.2 shell integration.
 *
 * Requires the explicit RC2 host patch declaring `page-app.shell`. The host
 * owns AppFrame and passes it into the Manager's full-window layout. No DOM
 * movement, overlay injection, or second DSH frontend is involved.
 * @param ctx - client root context that owns the injected contribution.
 * @param controller - Workspace Apps controller exposed to the outer shell.
 * @returns disposer that releases the RC2 wrapper contribution.
 */
export function registerRc2PageAppShell(
  ctx: ClientContext,
  controller: PageAppController,
): PageAppShellDisposer {
  return ctx.slots.inject('page-app.shell', () => ctx.slots.register({
    name: 'page-app.shell',
    priority: 0,
    children: {
      'page-app.shell.surface': {
        kind: 'keyed',
        scope: 'root',
      },
    },
    locale: NS,
    inject: () => shellInjected(controller),
  }, Rc2PageAppShell))
}
