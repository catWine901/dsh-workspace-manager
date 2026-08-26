/**
 * Workspace App shell registration: the manager owns the built-in `root` seat
 * and declares both child seats — the built-in DSH seat (`page-app.shell.
 * builtin`) and the keyed managed-surface seat (`page-app.shell.surface`).
 * The controller is constructed with the real generated `pageAppManager`
 * remote namespace, a slots-seam over the runtime ledger, a per-controller
 * opaque `crypto.randomUUID()` client instance, and an HMR graph-convergence
 * wait. The built-in seat never depends on remote readiness: without the
 * remote namespace the shell still registers (the controller degrades to a
 * read-only empty projection and DSH stays mounted), so composition ordering
 * cannot block the Original DSH Surface.
 * @module @deepseek-ai/dsh-client-ui-page-app-manager/client/apply
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type PageAppSettingsKey } from './locales.ts';
/** Dictionary namespace owned by this plugin (Workspace Apps settings copy). */
export declare const NS = "settings.pageApp";
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Workspace Apps settings tab copy. */
        'settings.pageApp': PageAppSettingsKey;
    }
}
/** Required services: the slot registry and the locale face (remote/modules are read defensively). */
export declare const inject: string[];
/**
 * Register the Workspace App shell into the built-in `root` seat and declare
 * both child seats, and contribute the Workspace Apps tab to Settings →
 * Plugins (spec §21/§22). The controller starts with the registration and
 * stops with its fiber; the built-in DSH seat mounts immediately regardless of
 * remote readiness (spec §3 guarantees the permanent fallback surface). The
 * Settings tab and the shell share one controller, so state and mutations
 * stay consistent across both surfaces.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=apply.d.ts.map