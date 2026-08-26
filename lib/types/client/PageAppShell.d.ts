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
import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { PageAppClientSnapshot } from './controller.ts';
import type { PageAppObservable } from './stores.ts';
/** The controller face the manager apply() hands to the shell registration. */
export interface PageAppShellInjected {
    /** Bare controller observable bound to `usePageApp` by the renderer. */
    hooks: {
        pageApp: PageAppObservable<PageAppClientSnapshot>;
    };
    /** Select one page (null = built-in DSH). */
    select: (pageId: string | null) => void;
    /** Uninstall one managed page (failure-surface action). */
    uninstall: (pageId: string) => void;
}
/** Full composed props: runtime share + child-slot render share + locale seat + inject face. */
export type PageAppShellProps = PropsRuntime<'root'> & PropsRenderSlots<'page-app.shell.builtin' | 'page-app.shell.surface'> & PropsLocale<'settings.pageApp'> & InjectFace<PageAppShellInjected>;
/** The root Workspace App shell (see module doc). */
export declare function PageAppShell({ usePageApp, select, uninstall, t, renderSlot }: PageAppShellProps): import("react").JSX.Element;
//# sourceMappingURL=PageAppShell.d.ts.map