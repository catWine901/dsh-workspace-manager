/**
 * React-free page-app controller: one stable observable snapshot over the
 * managed registry, the authorized surface contributions, the active/visited
 * page state, and the pending targeted activation. Mutations delegate to the
 * generated `pageAppManager` remote; the closed authorization projection (spec
 * §7) keeps unrelated, wrong-provenance, duplicate, or mismatched-revision
 * contributions invisible. No React import — the slot renderer binds it
 * through the inject.hooks compartment (Task 11).
 * @module @deepseek-ai/dsh-client-ui-page-app-manager/client/controller
 */
import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots';
import type { PageAppClientInstanceId, PageAppInstallSource, PageAppManagerSnapshot } from '@deepseek-ai/dsh-page-app-manager/types';
import { type PageAppActivationView, type PageAppManagerRemoteMethods, type PageAppRemoteEvents, type PageAppSlotsSeam } from './contracts.ts';
import { type PageAppObservable } from './stores.ts';
/** The controller's durable projection (stable reference between committed changes). */
export interface PageAppClientSnapshot {
    /**
     * The managed registry, or null before the first successful list (the
     * Settings tab renders the absent-registry error state from this).
     */
    readonly registry: PageAppManagerSnapshot | null;
    /** Authorized surface contributions keyed by page id (spec §7 closed projection). */
    readonly eligible: ReadonlyMap<string, StoredEntry>;
    /** The active page id, or null when the built-in DSH page is active. */
    readonly activePageId: string | null;
    /** Visited page ids in first-visit order (hidden pages are NOT evicted). */
    readonly visitedPageIds: readonly string[];
    /** The pending targeted activation, when one is open. */
    readonly activation: PageAppActivationView | null;
    /**
     * Managed surface page ids whose entries abdicated after a crash (slot
     * `reportEntryError` with `abdicate`); the shell renders a manager-owned
     * failure surface for each until a select (retry) or eviction clears it.
     */
    readonly failedPageIds: readonly string[];
}
/** Controller dependencies: remote, slot ledger, identity, and graph convergence. */
export interface PageAppControllerDeps {
    /** The generated `pageAppManager` remote namespace. */
    readonly remote: PageAppManagerRemoteMethods & PageAppRemoteEvents;
    /** The slot ledger (surface slot contributions). */
    readonly slots: PageAppSlotsSeam;
    /** This controller's opaque client instance (only it may acknowledge). */
    readonly clientInstanceId: PageAppClientInstanceId;
    /**
     * Wait for the client graph to converge to a pending activation's revision
     * (wired to the HMR graph reconcile by the shell). Resolves when converged.
     */
    readonly awaitGraphRevision: (graphRevision: string) => Promise<void>;
    /**
     * Cancel every pending graph-wait interval immediately. The controller
     * calls this from its stop path; the 30-second convergence cap is not a
     * cleanup mechanism, and repeated cancellation is a no-op.
     */
    readonly cancelGraphWait: () => void;
}
/**
 * The React-free controller: exposes one stable {@link PageAppObservable} over
 * the managed set and delegates mutations to the remote.
 */
export declare class PageAppController {
    private readonly deps;
    /** The stable observable the shell and Settings bind to. */
    readonly observable: PageAppObservable<PageAppClientSnapshot>;
    private readonly state;
    private registry;
    private activation;
    private convergedRevision;
    private cachedActivation;
    private readonly visited;
    private visitedOrder;
    private readonly failed;
    /** The tracked in-flight install controller (Settings cancel targets it). */
    private installAbort;
    private activePageId;
    private disposed;
    private readonly disposers;
    /**
     * @param deps - remote, slot ledger, client identity, and graph convergence.
     */
    constructor(deps: PageAppControllerDeps);
    /**
     * Subscribe to the manager events, the slot ledger, and the initial snapshot.
     * @returns the disposer.
     */
    start(): () => void;
    /**
     * Select one page (or null for the built-in DSH page). First visit mounts;
     * later visits reuse the mounted surface.
     * @param pageId - the page id, or null for DSH.
     */
    select(pageId: string | null): void;
    /**
     * Install one workspace package (Settings add-flow). The remote receives a
     * per-call AbortController signal linked to the caller's signal; controller
     * disposal and a later cancelInstall() abort the same controller.
     * @param source - the validated install source.
     * @param signal - cancellation.
     */
    install(source: PageAppInstallSource, signal: AbortSignal): Promise<void>;
    /**
     * Enable or disable one managed page.
     * @param pageId - the managed page id.
     * @param enabled - the new enabled state.
     * @param signal - cancellation.
     */
    setEnabled(pageId: string, enabled: boolean, signal: AbortSignal): Promise<void>;
    /**
     * Hide or show one managed page (presentation only).
     * @param pageId - the managed page id.
     * @param hidden - the new hidden state.
     */
    setHidden(pageId: string, hidden: boolean): Promise<void>;
    /**
     * Reorder managed pages.
     * @param pageIds - page ids in the desired order.
     */
    reorder(pageIds: readonly string[]): Promise<void>;
    /**
     * Uninstall one managed page from the current profile.
     * @param pageId - the managed page id.
     * @param signal - cancellation.
     */
    uninstall(pageId: string, signal: AbortSignal): Promise<void>;
    /** Run the startup/operator recovery over the profile journal. */
    recover(): Promise<void>;
    /**
     * Cancel the in-flight install (Settings cancel action). Aborts the tracked
     * install controller; the remote call rejects with the abort reason and the
     * Settings busy state clears through the install promise.
     */
    cancelInstall(): void;
    /**
     * Record one abdicated managed surface (slot entry crash). The shell swaps
     * the crashed cell for a manager-owned failure surface; a later select
     * (retry) or eviction clears the record.
     * @param pageId - the crashed surface's page id (the keyed slot key).
     */
    recordEntryError(pageId: string): void;
    /** Re-read the registry from the remote and rebuild the projection. */
    private refresh;
    /**
     * Link one per-call AbortController to the caller's signal: a pre-aborted
     * signal aborts immediately; a later external abort forwards. The remote
     * receives the per-call signal, so disposal and external cancellation share
     * one abort consumer.
     * @param controller - the per-call controller.
     * @param signal - the caller's cancellation signal.
     * @returns a disposer unlinking the forwarded abort listener.
     */
    private linkAbort;
    /** Rebuild the snapshot from current registry, activation, and selection state. */
    private rebuild;
    /**
     * Whether one page can stay active: a managed row that is present, enabled,
     * not hidden, and currently eligible (spec §10.3/§10.5 fallback rules).
     */
    private isSelectable;
    /**
     * The closed authorization projection (spec §7): a surface contribution is
     * eligible only when the registry owns the row, the row is enabled, the slot
     * key equals the page id, the immutable ownerPackage equals the package
     * name, and any pending activation names the same package, page id, and
     * revision. Rows an open activation does not name exactly, and rows with
     * duplicate matching contributions, are never projected.
     */
    private authorizedProjection;
    /** The renderable activation view (same reference while the activation facts are unchanged). */
    private activationView;
    /** Evict one page from visited (disable/uninstall lifecycle). */
    private evict;
    /** The initiating client acknowledges after the graph converges. */
    private acknowledge;
    /** Every client tracks graph convergence so the view's `converged` flag is accurate. */
    private trackConvergence;
}
//# sourceMappingURL=controller.d.ts.map