import { c as PageAppSourceKind$1, l as EntryOptions, n as ProfileRuntime, o as PageAppManifest, s as PageAppRegistryV1, t as ExpectedManagedRoot } from "./profile-runtime-bridge-OpnsCJny.js";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { Context } from "@deepseek-ai/cordis";
import { z } from "zod";
import { PatchOptions } from "@deepseek-ai/cordis-plugin-include";

//#region ../../util/brand/lib/types/index.d.ts
/**
 * The `Branded<B>` nominal-typing primitive — a type-only utility (no runtime
 * code, no harness-package dependency) shared by every package that owns a
 * cross-boundary id.
 *
 * A brand makes structurally-identical strings non-interchangeable at the type
 * level: a `SessionId` cannot be passed where a `CallId` is expected, even
 * though both are plain strings at runtime. Construction goes through a per-id
 * factory in the OWNING package (a plain cast inside — zero runtime cost);
 * comparison, logging, and serialization all behave as ordinary strings.
 *
 * Policy: a package brands the ids it owns — `CallId` in dsh-llm (tool-call
 * correlation), the shared agent/session `SessionId` in dsh-session, and
 * `JobId` in dsh-jobs. Branding is for ids that cross package boundaries and
 * could plausibly be confused; not every string needs a brand.
 * This package owns ONLY the primitive — no concrete id, no runtime code beyond
 * the (erased) type — so the brand vocabulary stays dependency-free and a
 * package can brand its ids without depending on an unrelated capability
 * package.
 *
 * @module @deepseek-ai/dsh-brand
 */
declare const BRAND: unique symbol;
/** A string carrying a compile-time-only brand `B`. */
type Branded<B extends string> = string & {
  readonly [BRAND]: B;
};
//#endregion
//#region lib/types/types.d.ts
/** How a managed package's source spec was stated at install time (wire copy). */
type PageAppSourceKind = 'registry' | 'file' | 'link' | 'tarball' | 'git';
/** Plugin configuration of the Host page-app manager (validated by the zod `Config` in `index.ts`). */
interface PageAppManagerConfig {
  /** Host cap on the client activation acknowledgement wait, in milliseconds. */
  readonly settlementTimeoutMs?: number;
}
/** Redacted source record persisted in the registry (wire copy; never carries credentials). */
interface PageAppRegistrySource {
  readonly kind: PageAppSourceKind;
  readonly display: string;
}
/** The manifest page fields every registry row echoes for its installed page (wire copy). */
interface PageAppPageFields {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultOrder: number;
  readonly rootEntryId: string;
}
/** The immutable active-profile identity as the manager projects it (wire copy of `ActiveProfileIdentity`). */
interface PageAppProfileIdentity {
  readonly name: string;
  readonly directory: string;
}
/** Durable phases of one page-app transaction journal (wire copy). */
type PageAppJournalPhase = 'prepared' | 'staged' | 'committing';
/**
 * Projected operational state of one profile's managed set — the closed union
 * every operation view state belongs to. The Host projection derives it from
 * the durable journal phase and registry recovery facts only (no persisted
 * operation-kind field): prepared/staged → `installing`, committing → `active`,
 * a visible recovery → `recovery-required`. `removing`/`install-failed`/
 * `remove-failed` stay members of the union but current facts never produce
 * them, so a view outside the union is a projection bug.
 */
type PageAppOperationState = 'installing' | 'active' | 'removing' | 'install-failed' | 'remove-failed' | 'recovery-required';
/** Semantic label of one managed root's Cordis fiber state (closed union; the terminal `DISPOSED` collapses into `failed`). */
type PageAppRuntimeStateLabel = 'pending' | 'loading' | 'active' | 'failed' | 'unloading';
/**
 * Derived operational health of one managed row. Manager lifecycle state and
 * Cordis runtime state are separate dimensions (spec §18); this view combines
 * them for display while the underlying data model keeps them distinct.
 */
type PageAppHealth = 'ready' | 'disabled' | 'missing-dependency' | 'version-drift' | 'invalid-manifest' | 'missing-manager' | 'activation-failed' | 'externally-overridden' | 'recovery-required';
/** One registry row joined with its derived health, as Settings reads it. */
interface PageAppView {
  readonly packageName: string;
  readonly source: PageAppRegistrySource;
  readonly resolvedVersion: string;
  readonly page: PageAppPageFields;
  readonly order: number;
  readonly enabled: boolean;
  readonly hidden: boolean;
  readonly installedAt: string;
  readonly updatedAt: string;
  readonly health: PageAppHealth;
  /** Loader fiber state label of the managed root, when the row maps to one. */
  readonly runtimeState?: PageAppRuntimeStateLabel;
  /** One-line failure summary when the row is unhealthy. */
  readonly lastError?: string;
}
/** In-flight mutation visibility projected from the durable journal and registry recovery facts. */
interface PageAppOperationView {
  /** Projected operational state (closed `PageAppOperationState` union). */
  readonly state: PageAppOperationState;
  /** Durable journal phase, present when a journal explains the state. */
  readonly phase?: PageAppJournalPhase;
}
/** Startup or rollback recovery visibility. */
interface PageAppRecoveryView {
  /** Actionable recovery message. */
  readonly message: string;
}
/** Immutable projection of the whole managed set for one profile. */
interface PageAppManagerSnapshot {
  /** Verified DSH/Adapter identity; clients fail closed before root takeover without it. */
  readonly host: import("./host-bridge.js").WorkspaceHostDescriptor;
  /** The immutable active-profile identity. */
  readonly profile: PageAppProfileIdentity;
  /** Registry revision (0 when no registry has been published). */
  readonly revision: number;
  /** Managed rows in registry order; the registry is the sole ownership source. */
  readonly entries: readonly PageAppView[];
  /** Present while a journaled mutation is in flight. */
  readonly operation: PageAppOperationView | null;
  /** Present when startup or rollback needs operator recovery. */
  readonly recovery: PageAppRecoveryView | null;
}
/** One validated install-source spec, ready for pnpm. */
interface PageAppInstallSource {
  /** The classified source kind. */
  readonly kind: PageAppSourceKind;
  /** The exact validated spec handed to pnpm. */
  readonly spec: string;
  /** Redacted source record the registry may persist. */
  readonly display: PageAppRegistrySource;
}
/** Payload of the `page-app-manager/activation-requested` event. */
interface PageAppActivationRequestedEvent {
  /** The transaction id the client acknowledgement must carry. */
  readonly transactionId: string;
  /** The opaque initiating client instance allowed to acknowledge. */
  readonly clientInstanceId: string;
  /** The installed package name. */
  readonly packageName: string;
  /** The managed page id. */
  readonly pageId: string;
  /** The graph revision the client must have converged to. */
  readonly graphRevision: string;
}
/** Branded transaction id (journal-visible identity of one mutation). */
type PageAppTransactionId = Branded<'PageAppTransactionId'>;
/** Branded opaque client-instance id (stable `crypto.randomUUID()` of the controller). */
type PageAppClientInstanceId = Branded<'PageAppClientInstanceId'>;
/** One pending activation the manager announces before staging. */
interface ClientActivationRequest {
  /** The transaction this activation belongs to. */
  readonly transactionId: PageAppTransactionId;
  /** The opaque initiating client instance that may acknowledge. */
  readonly clientInstanceId: PageAppClientInstanceId;
  /** The installed package name. */
  readonly packageName: string;
  /** The managed page id. */
  readonly pageId: string;
  /** The graph revision the client must have converged to. */
  readonly graphRevision: string;
}
/** Outcome of one acknowledgement attempt. */
interface ActivationAcknowledgement {
  /** Whether this attempt settled the transaction. */
  readonly accepted: boolean;
  /** Machine-readable refusal code when not accepted. */
  readonly reason?: 'stale' | 'wrong-client' | 'wrong-target' | 'already-settled';
}
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * The manager committed a registry change (install/enable/disable/hide/
     * reorder/uninstall published a new revision). Consumers re-read the
     * snapshot.
     * @param revision - the newly committed registry revision.
     * @mode emit
     */
    'page-app-manager/changed'(revision: number): void;
    /**
     * An install staged its runtime layer and now waits for the targeted
     * client instance to acknowledge the activation.
     * @param request - transaction, client instance, package, page, and graph revision.
     * @mode emit
     */
    'page-app-manager/activation-requested'(request: PageAppActivationRequestedEvent): void;
  }
} //# sourceMappingURL=types.d.ts.map
//#endregion
//#region lib/types/activation.d.ts
/**
 * One-shot activation gate. The manager opens it with the pending request
 * before applying the runtime layer; the first acknowledgement that matches
 * every field settles it. The gate is single-shot per transaction: it is
 * discarded after the transaction ends (success, rollback, or abort).
 */
declare class PageAppActivationGate {
  private request;
  private settled;
  private readonly waiters;
  /** Whether an activation is currently pending. */
  get pending(): boolean;
  /** The pending request, when one exists (even after settlement). */
  get pendingRequest(): ClientActivationRequest | undefined;
  /**
   * Announce the pending activation. A second open without settlement throws —
   * one gate, one transaction.
   * @param request - the targeted activation request.
   * @throws {Error} when a request is already open.
   */
  open(request: ClientActivationRequest): void;
  /**
   * Wait for the first valid acknowledgement, bounded by a Host timeout.
   * Rejects when the gate is discarded before any acknowledgement arrives,
   * when the signal aborts, or when the timeout elapses first — a vanished
   * client can never hold the profile lock indefinitely in a live process.
   * @param signal - cancellation; an aborted wait rejects.
   * @param timeoutMs - Host cap on the settlement wait; elapsing rejects.
   * @returns the settled request.
   */
  awaitSettlement(signal: AbortSignal, timeoutMs: number): Promise<ClientActivationRequest>;
  /**
   * Try to settle the transaction with one client acknowledgement. Only the
   * first acknowledgement matching the pending request (transaction id,
   * client instance, package, page, revision) is accepted; anything else is
   * refused with its reason.
   * @param transactionId - the acknowledgement's transaction id.
   * @param clientInstanceId - the acknowledging client instance.
   * @param packageName - the acknowledged package.
   * @param pageId - the acknowledged page id.
   * @param graphRevision - the graph revision the client converged to.
   * @returns whether this attempt settled the gate.
   */
  acknowledge(transactionId: PageAppTransactionId, clientInstanceId: PageAppClientInstanceId, packageName: string, pageId: string, graphRevision: string): ActivationAcknowledgement;
  /** Discard the gate (rollback/abort path): pending waiters reject. */
  discard(): void;
}
//#endregion
//#region lib/types/executor.d.ts
/**
 * Profile-local pnpm execution: one thin, injectable wrapper around execa so
 * transactions can run, fake, cancel, and diagnose pnpm without ever
 * concatenating user input into a shell command. Arguments travel as an
 * array; on Windows execa resolves `pnpm` to `pnpm.cmd` itself (the test pins
 * the array-call shape, never a joined string).
 * @module @deepseek-ai/dsh-page-app-manager/executor
 */
/** One finished pnpm command's captured outcome (bounded capture). */
interface PackageCommandResult {
  /** Process exit code (non-zero = failure; the manager maps codes itself). */
  readonly exitCode: number;
  /** Captured stdout (bounded). */
  readonly stdout: string;
  /** Captured stderr (bounded). */
  readonly stderr: string;
}
/** The pnpm-execution seam transactions consume (fakeable in tests). */
interface PageAppPackageExecutor {
  /**
   * Run one pnpm command in `cwd`.
   * @param args - exact argument list (never a shell string).
   * @param options - working directory and cancellation signal.
   * @returns the captured result; a spawn failure is returned as a result
   * with a non-zero exit code, never thrown (except an AbortError).
   */
  run(args: readonly string[], options: {
    cwd: string;
    signal: AbortSignal;
  }): Promise<PackageCommandResult>;
}
/** Error thrown when the caller's AbortSignal fired mid-command. */
declare class PageAppCommandAbortedError extends Error {
  constructor();
}
/** Structural execa result surface the executor reads (execa v10 shape; exitCode optional). */
interface ExecaResult {
  exitCode?: number | null;
  stdout: string;
  stderr: string;
}
/** execa-style spawn function signature the executor accepts (injectable). */
type PnpmSpawn = (file: string, args: readonly string[], options: {
  cwd: string;
  cancelSignal: AbortSignal;
  reject: false;
}) => Promise<ExecaResult>;
/**
 * Build the production pnpm executor. Windows `.cmd` resolution is execa's
 * own PATH walk — the manager never builds a shell command.
 * @param spawn - injectable execa binding (defaults to execa with reject:false).
 * @returns the executor.
 */
declare function createPnpmExecutor(spawn?: PnpmSpawn): PageAppPackageExecutor;
//#endregion
//#region lib/types/transaction.d.ts
/** Error whose message names pnpm's exact allowBuilds/build-script diagnostic. */
declare class PageAppBuildPermissionError extends Error {}
/** Transaction execution dependencies. */
interface PageAppTransactionDeps {
  /** Absolute profile directory. */
  readonly profileDir: string;
  /** The pnpm execution seam. */
  readonly executor: PageAppPackageExecutor;
  /** The launcher-owned acknowledged profile recomposition service. */
  readonly runtime: ProfileRuntime;
  /** Package identity that owns the wrapper export in this runtime. */
  readonly managerPackageName?: string;
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
interface PageAppStagedState {
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
declare class PageAppLifecycle {
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
declare function derivePageAppExpectedRoots(profileDir: string, registry: PageAppRegistryV1, managerPackageName?: string): ExpectedManagedRoot[];
//#endregion
//#region lib/types/source.d.ts
/**
 * Parse one install source spec into a validated, redacted source record.
 * Registry and Git specs may be typed explicitly by the caller; local kinds
 * are always validated as absolute picker-backed paths.
 * @param spec - the raw specifier from the Settings add-flow.
 * @param kind - optional explicit kind; when omitted the spec is classified.
 * @returns the immutable validated install source.
 * @throws {Error} for credential-bearing URLs, empty specs, kind mismatches,
 * or ambiguous relative filesystem specs.
 */
declare function parsePageAppInstallSource(spec: string, kind?: PageAppSourceKind$1): PageAppInstallSource;
//#endregion
//#region lib/types/validation.d.ts
/** Profile facts the validation compares the staged package against. */
interface PageAppValidationContext {
  /** Absolute profile directory (resolution anchor; never Host cwd). */
  readonly profileDir: string;
  /** Current manager registry; uniqueness checks apply against it. */
  readonly registry: PageAppRegistryV1 | null;
  /** Effective root entry ids of the base composition below the manager layer. */
  readonly baseRootIds: readonly string[];
  /** Profile `package.json` dependencies (name → specifier). */
  readonly profileDependencies: Readonly<Record<string, string>>;
  /** Profile `dsh.profile.bundles` entries (externally managed bundles). */
  readonly profileBundles: readonly string[];
}
/** The statically validated record the install transaction stages. */
interface PageAppValidatedRecord {
  /** The package name (equals the direct profile dependency key). */
  readonly packageName: string;
  /** Installed version (the resolvedVersion the registry commits). */
  readonly version: string;
  /** The parsed `dsh.workspace` v1 manifest block. */
  readonly manifest: PageAppManifest;
  /** The Managed Root top-level Loader row id (=== manifest.rootEntryId). */
  readonly rootEntryId: string;
  /** The Managed Root top-level row itself (serializable, declarative). */
  readonly rootRow: EntryOptions;
  /** Number of composed client rows this package contributes (exactly 1). */
  readonly clientRowCount: number;
}
/**
 * Probe the installed location of one package from the profile's own
 * node_modules walk — the same anchor the profile runtime uses. Manager
 * packages are profile-local pnpm installs, so the profile anchor finds them
 * before any parent fallback.
 * @param profileDir - absolute profile directory.
 * @param packageName - the package name to locate.
 * @returns the installed package directory, or undefined when not installed.
 */
declare function resolveInstalledPackageDir(profileDir: string, packageName: string): string | undefined;
/**
 * Validate one installed package against the full static contract (spec §11).
 * Every check throws a labeled error; a passing call returns the validated
 * record the install transaction can stage. The function never mutates the
 * registry, the profile manifest, or any owned file.
 * @param profileDir - absolute profile directory.
 * @param packageName - the direct profile dependency key being validated.
 * @param context - registry, base composition, and profile facts.
 * @returns the immutable validated record.
 * @throws {Error} naming the first violated rule.
 */
declare function validateInstalledPageAppPackage(profileDir: string, packageName: string, context: PageAppValidationContext): PageAppValidatedRecord;
//#endregion
//#region lib/types/recovery.d.ts
/** The recovery decision for one profile. */
type PageAppRecoveryAction = 'none' | 'commit-completed' | 'restored' | 'recovery-required';
/** Outcome of one recovery attempt. */
interface PageAppRecoveryOutcome {
  readonly action: PageAppRecoveryAction;
  /** Actionable message when the outcome is not silent. */
  readonly message?: string;
}
/**
 * Recover one profile's unfinished transaction. Runs after orphan-lock
 * takeover, inside the shared manager profile lock, and restores the live
 * Include tree through `restoreManagerLayer` before converging files.
 * @param profileDir - absolute profile directory.
 * @param executor - the pnpm seam used for inverse/convergence operations.
 * @param runtime - the launcher-owned profile runtime (live-layer restore).
 * @returns the recovery decision.
 */
declare function recoverPageAppTransaction(profileDir: string, executor: PageAppPackageExecutor, runtime: ProfileRuntime): Promise<PageAppRecoveryOutcome>;
/** The owned-file list is exported for the recovery-table tests. */
declare const RECOVERY_OWNED_FILES: readonly string[];
//#endregion
//#region lib/types/workbench-runtime.d.ts
/** The service name the manager provides the Workbench Runtime under. */
declare const WORKBENCH_RUNTIME_SERVICE = "workbenchRuntime";
/** One workspace surface seat registered through the contract. */
interface WorkbenchSurfaceRegistration {
  /** The managed page id the surface seat is keyed by. */
  readonly pageId: string;
  /** The owning package name (provenance lineage, equals the wrapper's feature package). */
  readonly packageName: string;
  /**
   * The surface render contributed by the Feature. The host half records the
   * seat and provenance; the client render fills this through the Workbench
   * Context injection face when the fixture migrates (M9).
   */
  readonly render?: unknown;
}
/** One event subscription the runtime holds for a Feature. */
interface WorkbenchEventSubscription {
  /**
   * Subscribe to one runtime event name.
   * @param name - the event name.
   * @param listener - the listener invoked with the emitted payload.
   * @returns a disposer that removes the listener.
   */
  on(name: string, listener: (payload: unknown) => void): () => void;
  /**
   * Emit one runtime event.
   * @param name - the event name.
   * @param payload - the payload every listener receives.
   */
  emit(name: string, payload?: unknown): void;
}
/** The Feature-facing domain API the manager provides. */
interface WorkbenchRuntime {
  /** Lifecycle disposal: every side effect a Feature registers releases with the runtime. */
  readonly lifecycle: {
    /**
     * Register one disposal callback that runs when the runtime fiber unloads.
     * @param callback - the callback to run at disposal.
     * @returns a disposer that removes the callback.
     */
    onDispose(callback: () => void): () => void;
  };
  /** Workspace-surface registration: the contract's single surface entry. */
  readonly surfaces: {
    /**
     * Register one workspace surface seat. The returned disposer removes the
     * registration; the runtime records the owning package provenance.
     * @param registration - page id, owning package, and the surface render.
     * @returns a disposer that removes the registration.
     */
    registerWorkspaceSurface(registration: WorkbenchSurfaceRegistration): () => void; /** Every live surface registration, in registration order. */
    list(): readonly WorkbenchSurfaceRegistration[];
  };
  /** Runtime events: the Feature subscribes through the contract, never Cordis. */
  readonly events: WorkbenchEventSubscription;
  /** Keyed storage the runtime owns per fiber. */
  readonly storage: {
    /** Read one stored value (undefined when absent). */get(key: string): unknown; /** Store one value under a key. */
    set(key: string, value: unknown): void;
  };
  /** Host call seam: the Feature invokes Host capabilities by name. */
  readonly host: {
    /**
     * Call one Host capability. Contract v1 keeps the seam but wires no
     * capability yet: the fixture migration (M9) registers the surface
     * lifecycle behind this face, so an unknown method fails loud instead of
     * silently no-oping.
     * @param method - the capability name.
     * @param args - the capability arguments.
     * @returns the capability result.
     * @throws {Error} naming the unwired method.
     */
    call(method: string, ...args: unknown[]): Promise<unknown>;
  };
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The Workbench Runtime service provided by the manager fiber. */
    workbenchRuntime: WorkbenchRuntime;
  }
}
/**
 * Build the Workbench Runtime for one manager fiber. The runtime's ctx effect
 * owns every registered side effect: when the fiber unloads, disposer-owned
 * callbacks, surface seats, listeners, and storage release together, and the
 * service unregistration (Cordis's provide disposer) re-evaluates dependent
 * wrapper fibers.
 * @param ctx - the manager's plugin context (the providing fiber).
 * @returns the Feature-facing domain API.
 */
declare function createWorkbenchRuntime(ctx: Context): WorkbenchRuntime;
//#endregion
//#region lib/types/index.d.ts
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
declare class PageAppManager extends TypertRemoteService {
  private readonly profileRuntime;
  private readonly lifecycle;
  constructor(ctx: Context, options: {
    profileRuntime: ProfileRuntime;
    executor?: PageAppPackageExecutor; /** The resolved plugin config: the Host settlement-wait cap. */
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
declare const name = "page-app-manager";
/** Required services: the launcher-owned profile runtime and the Loader. */
declare const inject: string[];
/** Validated plugin config: the Host settlement-wait cap (defaults in the schema). */
declare const Config: z.ZodObject<{
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
declare function apply(ctx: Context, config: PageAppManagerConfig): void;
//#endregion
export { ActivationAcknowledgement, ClientActivationRequest, Config, PackageCommandResult, PageAppActivationGate, PageAppActivationRequestedEvent, PageAppBuildPermissionError, PageAppClientInstanceId, PageAppCommandAbortedError, PageAppHealth, PageAppInstallSource, PageAppJournalPhase, PageAppLifecycle, PageAppManager, PageAppManagerConfig, PageAppManagerSnapshot, PageAppOperationState, PageAppOperationView, PageAppPackageExecutor, PageAppPageFields, PageAppProfileIdentity, PageAppRecoveryAction, PageAppRecoveryOutcome, PageAppRecoveryView, PageAppRegistrySource, PageAppRuntimeStateLabel, PageAppSourceKind, PageAppStagedState, PageAppTransactionDeps, PageAppTransactionId, PageAppValidatedRecord, PageAppValidationContext, PageAppView, PnpmSpawn, RECOVERY_OWNED_FILES, WORKBENCH_RUNTIME_SERVICE, WorkbenchEventSubscription, WorkbenchRuntime, WorkbenchSurfaceRegistration, apply, createPnpmExecutor, createWorkbenchRuntime, derivePageAppExpectedRoots, inject, name, parsePageAppInstallSource, recoverPageAppTransaction, resolveInstalledPackageDir, validateInstalledPageAppPackage };
