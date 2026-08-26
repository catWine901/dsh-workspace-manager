/**
 * Workspace Apps settings tab (Settings → Plugins → Workspace, spec §21/§22):
 * add a workspace plugin from a single source field, manage rows (show/hide,
 * reorder, enable/disable, uninstall with confirmation), view the committed
 * profile identity, and run startup/rollback recovery. Every mutation
 * delegates to the Host through the controller — the browser never touches
 * packages or the filesystem. Disabled, hidden, unhealthy, and
 * recovery-required rows stay listed (the rail may hide them; Settings must
 * not).
 * @module @deepseek-ai/dsh-client-ui-page-app-manager/client/PageAppSettingsTab
 */
import { type ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { PageAppClientSnapshot } from './controller.ts';
import type { PageAppObservable } from './stores.ts';
/** The controller face the manager apply() hands to the tab registration. */
export interface PageAppSettingsTabInjected {
    /** Bare controller observable bound to `usePageApp` by the renderer. */
    hooks: {
        pageApp: PageAppObservable<PageAppClientSnapshot>;
    };
    /** Install one workspace package. */
    install: (source: string, signal: AbortSignal) => Promise<void>;
    /** Enable or disable one managed page. */
    setEnabled: (pageId: string, enabled: boolean, signal: AbortSignal) => Promise<void>;
    /** Hide or show one managed page. */
    setHidden: (pageId: string, hidden: boolean) => Promise<void>;
    /** Uninstall one managed page. */
    uninstall: (pageId: string, signal: AbortSignal) => Promise<void>;
    /** Run startup/operator recovery over the profile journal. */
    recover: () => Promise<void>;
    /** Cancel the in-flight install (aborts the controller's per-call signal). */
    cancelInstall: () => void;
}
/** Full composed props: runtime share + locale seat + inject face. */
export type PageAppSettingsTabProps = PropsRuntime<'settings.plugins.tab'> & PropsLocale<'settings.pageApp'> & InjectFace<PageAppSettingsTabInjected>;
/** Render the Workspace Apps settings tab. */
export declare function PageAppSettingsTab({ usePageApp, t, install, setEnabled, setHidden, uninstall, recover, cancelInstall }: PageAppSettingsTabProps): ReactNode;
//# sourceMappingURL=PageAppSettingsTab.d.ts.map