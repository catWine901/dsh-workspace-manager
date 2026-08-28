/** RC2 adapter: the patched host passes its original AppFrame as a child. */

import type {
  InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import { PageAppShellView, type PageAppShellInjected } from './PageAppShell.tsx'

/** Owner props come from the host root wrapper, not the Native DSH overlay. */
export type Rc2PageAppShellProps =
  & PropsRuntime<'page-app.shell'>
  & PropsRenderSlots<'page-app.shell.surface'>
  & PropsLocale<'settings.pageApp'>
  & InjectFace<PageAppShellInjected>

/** Reuse the full shell; switching pages changes visibility, not component ownership. */
export function Rc2PageAppShell({ nativeSurface, usePageApp, select, uninstall, t, renderSlot }: Rc2PageAppShellProps) {
  return (
    <PageAppShellView
      nativeSurface={nativeSurface}
      usePageApp={usePageApp}
      select={select}
      uninstall={uninstall}
      t={t}
      renderSurface={pageId => renderSlot('page-app.shell.surface', {}, { entryKey: pageId })}
    />
  )
}
