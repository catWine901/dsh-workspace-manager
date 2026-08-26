/**
 * Host page-app manager service: the read-only projection of one profile's
 * managed Workspace Apps plus staged-dependency validation. The registry is the
 * sole ownership authority — Plugin Inventory and unrelated Loader rows never
 * create entries — and every mutation (install/enable/disable/uninstall)
 * arrives in the transaction task (Task 8). The manager root is constructed
 * from the profile runtime and Loader facts only, so management-API readiness
 * can never gate the built-in DSH shell (SR-09). Mutating Remote methods carry
 * a final `signal` the transaction honors, the activation acknowledgement is
 * bounded by the configurable `settlementTimeoutMs`, and the lifecycle is
 * disposed with the manager fiber so a reload cannot orphan a transaction.
 * @module @deepseek-ai/dsh-page-app-manager
 */
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { Context } from '@deepseek-ai/cordis';
import { z } from 'zod';
import { type ProfileRuntime } from '@deepseek-ai/dsh-app-boot';
import type { PageAppClientInstanceId, PageAppManagerConfig, PageAppTransactionId } from './types.ts';
import type { PageAppManagerSnapshot, PageAppInstallSource } from './types.ts';
import { PageAppLifecycle } from './transaction.ts';
import { type PageAppPackageExecutor } from './executor.ts';
export * from './types.ts';
export * from './source.ts';
export * from './validation.ts';
export * from './executor.ts';
export * from './activation.ts';
export * from './transaction.ts';
export * from './recovery.ts';
export * from './workbench-runtime.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** The Host page-app manager service (profile-scoped ownership projection). */
        pageAppManager: PageAppManager;
    }
}
/**
 * Build the Host page-app manager service. Extends `TypertRemoteService` so the
 * generated `pageAppManager` namespace exposes the mutation API; the read
 * projection and staged validation are plain methods on the same service.
 * @param ctx - plugin context with the Loader available.
 * @param options - the launcher-provided profile runtime (identity source).
 */
export declare class PageAppManager extends TypertRemoteService {
    private readonly profileRuntime;
    private readonly lifecycle;
    constructor(ctx: Context, options: {
        profileRuntime: ProfileRuntime;
        executor?: PageAppPackageExecutor;
        /** The resolved plugin config: the Host settlement-wait cap. */
        config: {
            settlementTimeoutMs: number;
        };
    });
    /** The immutable active-profile identity (consumers cannot replace it). */
    get identity(): {
        name: string;
        directory: string;
    };
    /** The pending targeted client activation gate (install acknowledgement). */
    get activation(): PageAppLifecycle['activation'];
    /** Abort the in-flight transaction; wired to the manager fiber's effect. */
    dispose(): void;
    /**
     * The full read-only projection of the managed set. The registry is the
     * ownership authority; health is derived from current dependency, version,
     * and runtime facts. Plugin Inventory and unrelated Loader rows never create
     * entries.
     * @returns the immutable snapshot.
     */
    list(): PageAppManagerSnapshot;
    /**
     * Install one managed package (exposed as the `installPackage` Remote of the
     * Settings add-flow; the gateway namespace service reserves the `install`
     * member on its prototype, so the wire method cannot reuse that spelling
     * while the internal lifecycle method keeps the `install` name).
     * @param source - the validated install source.
     * @param clientInstanceId - the opaque initiating client instance.
     * @param signal - cancellation; aborts pnpm and the activation wait.
     * @returns the committed registry revision.
     */
    install(source: PageAppInstallSource, clientInstanceId: PageAppClientInstanceId, signal: AbortSignal): Promise<number>;
    /**
     * Enable or disable one managed page.
     * @param pageId - the managed page id.
     * @param enabled - the new enabled state.
     * @param signal - cancellation; honored by the shared lock.
     * @returns the committed registry revision.
     */
    setEnabled(pageId: string, enabled: boolean, signal: AbortSignal): Promise<number>;
    /**
     * Hide or show one managed page (presentation only).
     * @param pageId - the managed page id.
     * @param hidden - the new hidden state.
     * @returns the committed registry revision.
     */
    setHidden(pageId: string, hidden: boolean): Promise<number>;
    /**
     * Reorder managed pages.
     * @param pageIds - page ids in the desired order.
     * @returns the committed registry revision.
     */
    reorder(pageIds: readonly string[]): Promise<number>;
    /**
     * Uninstall one managed page from the current profile.
     * @param pageId - the managed page id.
     * @param signal - cancellation; aborts pnpm and the activation wait.
     * @returns the committed registry revision.
     */
    uninstall(pageId: string, signal: AbortSignal): Promise<number>;
    /**
     * Acknowledge a pending targeted client activation. Only the first valid
     * acknowledgement from the initiating client instance settles the install.
     * @param transactionId - the transaction the acknowledgement names.
     * @param clientInstanceId - the acknowledging client instance.
     * @param packageName - the acknowledged package.
     * @param pageId - the acknowledged page id.
     * @param graphRevision - the graph revision the client converged to.
     * @returns whether this attempt settled the transaction.
     */
    ackClientActivation(transactionId: PageAppTransactionId, clientInstanceId: PageAppClientInstanceId, packageName: string, pageId: string, graphRevision: string): {
        accepted: boolean;
        reason?: string;
    };
    /**
     * Run the startup/operator recovery over the profile journal.
     * @returns the recovery outcome.
     */
    recover(): Promise<{
        action: string;
        message?: string;
    }>;
    /**
     * The full read-only projection of the managed set (the `list` Remote
     * delegates here; the raw method stays available to host-side consumers).
     * @returns the immutable snapshot.
     */
    snapshot(): PageAppManagerSnapshot;
    /**
     * Parse and classify one Settings add-flow source spec. Local directory
     * sources are additionally preflighted against the on-disk package; registry,
     * git, link, and tarball sources await the pnpm staging step (Task 8) before
     * the full static validation runs. Never mutates ownership.
     * @param source - the raw specifier (or an already-typed source).
     * @returns the validated install source plus a preflight note.
     * @throws {Error} when the spec is rejected (kind grammar, credentials, relative path).
     */
    validateInstall(source: string | PageAppInstallSource): {
        source: PageAppInstallSource;
        preflight: string | null;
    };
    /** Project one registry row into its view with derived health. */
    private viewOf;
    /** Collect the current dependency/version/manifest/bundle/runtime facts of one row. */
    private factsOf;
}
/** Stable Cordis plugin name. */
export declare const name = "page-app-manager";
/** Required services: the launcher-owned profile runtime and the Loader. */
export declare const inject: string[];
/** Validated plugin config: the Host settlement-wait cap (defaults in the schema). */
export declare const Config: z.ZodObject<{
    settlementTimeoutMs: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Mount the Host page-app manager service as a Cordis plugin: reads the
 * launcher-owned profile runtime (the immutable identity and the only
 * acknowledged live-recomposition writer), provides the Workbench Runtime
 * under the contract service name (the Feature Runtime Wrapper fibers inject
 * it, so provider loss parks them PENDING and return reloads them), and
 * constructs the manager over the runtime. The manager must never infer the
 * profile from cwd or browser arguments (spec §8.1). Constructing the
 * TypertRemoteService registers it on the caller's fiber, so it unregisters
 * automatically when the fiber unloads; the effect disposes the lifecycle so
 * an in-flight transaction aborts with the manager fiber instead of orphaning
 * under a half-dead manager. The `ctx.provide` call is itself fiber-scoped:
 * its disposer deletes the service and re-evaluates every dependent wrapper.
 * @param ctx - Host context with the profile runtime and Loader mounted.
 * @param config - resolved plugin config (Cordis applies the schema default).
 */
export declare function apply(ctx: Context, config: PageAppManagerConfig): void;
//# sourceMappingURL=index.d.ts.map