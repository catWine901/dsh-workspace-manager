/**
 * Journaled lifecycle transactions for managed Workspace Apps (spec §10).
 * Every mutation runs inside the shared profile mutation lock, writes a
 * prepared journal plus private before-state backups BEFORE any owned file
 * changes, stages the registry + derived runtime layer, applies the layer
 * through the acknowledged ProfileRuntime recomposition, and only then
 * publishes the registry and removes the journal. Any failure before COMMIT
 * rolls back: restore backups, run the inverse pnpm operation, restore the
 * profile manifest/lockfile, and converge `node_modules` with a profile-local
 * `pnpm install`. A failed convergence retains the journal and exposes
 * `recovery-required` — the system never pretends to be clean (spec §27).
 * Cancellation flows end-to-end: the Remote signal and the manager fiber's
 * lifecycle controller are merged per transaction, so an abort or a manager
 * reload cancels pnpm and the activation wait, and the acknowledgement wait is
 * bounded by the configurable `settlementTimeoutMs` (spec §10.3).
 * @module @deepseek-ai/dsh-page-app-manager/transaction
 */
import { type ProfileRuntime } from '@deepseek-ai/dsh-app-boot';
import { type ExpectedManagedRoot } from '@deepseek-ai/dsh-app-boot';
import { type PageAppRegistryV1 } from '@deepseek-ai/dsh-page-app-profile';
import type { PageAppInstallSource } from './types.ts';
import type { ClientActivationRequest, PageAppClientInstanceId } from './types.ts';
import { PageAppActivationGate } from './activation.ts';
import type { PageAppPackageExecutor } from './executor.ts';
/** Error whose message names pnpm's exact allowBuilds/build-script diagnostic. */
export declare class PageAppBuildPermissionError extends Error {
}
/** Transaction execution dependencies. */
export interface PageAppTransactionDeps {
    /** Absolute profile directory. */
    readonly profileDir: string;
    /** The pnpm execution seam. */
    readonly executor: PageAppPackageExecutor;
    /** The launcher-owned acknowledged profile recomposition service. */
    readonly runtime: ProfileRuntime;
    /** Absolute pnpm-workspace.yaml path (never edited; allowBuilds diagnostics read it). */
    readonly pnpmWorkspaceFile: string;
    /** Host cap on the client activation acknowledgement wait, in milliseconds. */
    readonly settlementTimeoutMs: number;
    /**
     * Read the Host client-graph revision the install's activation request
     * carries. The acknowledgement is only meaningful against the exact graph
     * the client must converge to, never the runtime-layer document.
     */
    readonly clientGraphRev: () => string;
    /** Called after each committed registry publication (the manager emits `page-app-manager/changed`). */
    readonly onChanged?: (revision: number) => void;
    /** Called when the targeted activation gate opens (the manager emits `page-app-manager/activation-requested`). */
    readonly onActivationRequested?: (request: ClientActivationRequest) => void;
}
/** The registry revision + staged layer one transaction will commit. */
export interface PageAppStagedState {
    readonly registry: PageAppRegistryV1;
    readonly layer: string;
    /** The runtime-audit expectations of the staged roots (hashes never empty). */
    readonly expectedRoots: readonly ExpectedManagedRoot[];
}
/**
 * Run one journaled lifecycle operation. Installs, enable/disable, hide,
 * reorder, and uninstall share the transaction scaffolding: lock, snapshot,
 * stage, apply, publish, journal.
 */
export declare class PageAppLifecycle {
    private readonly deps;
    private readonly gate;
    /** Aborts the in-flight transaction when the manager fiber unloads. */
    private readonly inFlight;
    private disposed;
    /**
     * @param deps - profile, pnpm seam, runtime, pnpm-workspace path, settlement
     * timeout, and the client-graph revision reader.
     */
    constructor(deps: PageAppTransactionDeps);
    /** The pending targeted activation (null between transactions). */
    get activation(): PageAppActivationGate;
    /**
     * Abort the in-flight transaction and refuse further mutations. Wired to the
     * manager fiber's effect, so a manager reload cannot orphan a running
     * transaction (the profile lock releases through rollback).
     */
    dispose(): void;
    /**
     * Install one managed package (spec §10.1): pnpm add → resolve → static
     * validation → stage → apply → targeted client acknowledgement → publish.
     * @param source - the validated install source.
     * @param clientInstanceId - the opaque initiating client instance (only it
     * may acknowledge).
     * @param signal - cancellation (aborts pnpm and the acknowledgement wait).
     * @returns the committed registry revision.
     */
    install(source: PageAppInstallSource, clientInstanceId: PageAppClientInstanceId, signal: AbortSignal): Promise<number>;
    /**
     * Enable or disable one managed page (spec §10.2/§10.3): stage the registry
     * row and the derived layer, apply, and publish. Disable unloads the root;
     * enable remounts it. Never runs pnpm.
     * @param pageId - the managed page id.
     * @param enabled - the new enabled state.
     * @param signal - cancellation.
     * @returns the committed registry revision.
     */
    setEnabled(pageId: string, enabled: boolean, signal: AbortSignal): Promise<number>;
    /**
     * Hide one managed page (spec §10.5): presentation only — no runtime layer
     * change, no unload.
     * @param pageId - the managed page id.
     * @param hidden - the new hidden state.
     * @returns the committed registry revision.
     */
    setHidden(pageId: string, hidden: boolean): Promise<number>;
    /**
     * Reorder managed pages (spec §10.5): presentation only.
     * @param pageIds - page ids in the desired order (rows not listed keep their relative order after them).
     * @returns the committed registry revision.
     */
    reorder(pageIds: readonly string[]): Promise<number>;
    /**
     * Uninstall one managed page (spec §10.4): disable/unload sequence, pnpm
     * remove, remove the row, publish. The manager never deletes the original
     * local source or the pnpm global store.
     * @param pageId - the managed page id.
     * @param signal - cancellation.
     * @returns the committed registry revision.
     */
    uninstall(pageId: string, signal: AbortSignal): Promise<number>;
    private withTransaction;
    /** Stage the next registry + derived layer after a successful pnpm add. */
    private stageAfterInstall;
    /**
     * Resolve the direct profile dependency key one successful `pnpm add` wrote.
     * The key comes from observable post-add profile state (the before/after
     * manifest delta), never pathname parsing or raw-spec heuristics: for a
     * local link:/file:/tarball/Git source pnpm keys the dependency by the
     * package's OWN name and the spec is only the dependency value, so the raw
     * spec can never name node_modules. A registry source keeps its bare package
     * name as the valid direct key when present — including a no-delta
     * reinstall where pnpm leaves the manifest dependency untouched. Non-registry
     * sources must produce exactly one added or changed key; zero or multiple
     * candidates are rejected with a deterministic, actionable error — never
     * guessed.
     * @param source - the validated install source.
     * @param before - the profile's direct dependencies captured before `pnpm add`.
     * @param after - the profile's direct dependencies read after success.
     * @returns the direct dependency key of the installed package.
     * @throws {Error} when a non-registry source produced zero or multiple
     * added/changed keys.
     */
    private resolveInstalledPackageKey;
    /** Derive the layer for a staged registry (enabled, statically valid rows only). */
    private stageFromRegistry;
    /** Write the staged runtime layer file, then advance the journal to staged. */
    private writeStagedLayer;
    /** Apply the staged layer through the acknowledged profile runtime. */
    private applyRuntime;
    /** Publish the registry and advance the journal to committing. */
    private publish;
    /** Re-read the durable journal and walk it forward to the target phase (never a stale in-memory object). */
    private advanceTo;
    /** Restore before-state and converge; a failed convergence retains the journal. */
    private rollback;
    /**
     * Restore the prior manager-layer generation the journal recorded: stage the
     * before layer, recompute its expected-root hashes from the before registry,
     * and await the runtime's restore audit. A restore failure propagates so the
     * journal stays and recovery-required is reported.
     */
    private restoreLiveLayer;
    private requireRegistry;
    private requireRegistrySync;
    private readProfileDependencies;
}
/**
 * Derive the runtime-audit expectations for one registry (rollback/recovery
 * restore paths recompute them from the journal's before-state). Hashes are
 * `managedRootHash` (the adapter's `canonicalManagedRootHash` delegate) of the
 * Feature Runtime Wrapper parent row — never empty — so the audit and the
 * health lookup share the wrapper form.
 * @param profileDir - absolute profile directory (resolution anchor).
 * @param registry - the registry to derive enabled roots from.
 * @returns one expectation per enabled, statically valid row.
 */
export declare function derivePageAppExpectedRoots(profileDir: string, registry: PageAppRegistryV1): ExpectedManagedRoot[];
//# sourceMappingURL=transaction.d.ts.map