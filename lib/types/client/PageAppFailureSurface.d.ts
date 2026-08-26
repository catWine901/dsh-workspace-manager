/**
 * Manager-owned failure surface for one abdicated managed surface (spec §12
 * G-13): replaces the crashed cell inside the keep-mounted wrapper so the
 * rail and the other surfaces stay usable. Retry re-selects the page (the
 * shell remounts the slot); uninstall runs the existing uninstall flow.
 * Pure presentation: the shell hands the page id, the translate seat, and the
 * two actions as props.
 * @module @deepseek-ai/dsh-client-ui-page-app-manager/client/PageAppFailureSurface
 */
import type { ReactNode } from 'react';
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { PageAppSettingsKey } from './locales.ts';
/** Props of the failure face: identity, copy, and the two recovery actions. */
export interface PageAppFailureSurfaceProps {
    /** The crashed managed surface's page id. */
    readonly pageId: string;
    /** The shell's namespace-bound translate seat. */
    readonly t: Translate<PageAppSettingsKey>;
    /** Re-select the page (the shell remounts the surface slot). */
    readonly onRetry: () => void;
    /** Run the existing uninstall flow for the page. */
    readonly onUninstall: () => void;
}
/** The manager-owned failure face (see module doc). */
export declare function PageAppFailureSurface({ pageId, t, onRetry, onUninstall }: PageAppFailureSurfaceProps): ReactNode;
//# sourceMappingURL=PageAppFailureSurface.d.ts.map