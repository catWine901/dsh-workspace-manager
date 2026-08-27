import { LoadHookContext } from "node:module";
import { Context, Fiber, Inject, Service } from "@deepseek-ai/cordis";
import { z } from "zod";
import { PatchOptions } from "@deepseek-ai/cordis-plugin-include";

//#region ../../../vendor/cosmokit/lib/types/misc.d.ts
/** String/symbol keyed dictionary type. */
type Dict<T = any, K extends string | symbol = string> = { [key in K]: T };
//#endregion
//#region ../../../vendor/loader/lib/types/internal.d.ts
/** Node internal module format names handled by loader hooks. */
type ModuleFormat = 'builtin' | 'commonjs' | 'json' | 'module' | 'wasm';
/** Source payload accepted by Node internal module load hooks. */
type ModuleSource = string | ArrayBuffer;
/** Result returned by a Node internal resolve hook. */
interface ResolveResult {
  format: ModuleFormat;
  url: string;
}
/** Result returned by a Node internal load hook. */
interface LoadResult {
  format: ModuleFormat;
  source?: ModuleSource;
}
type LoadCacheData = ModuleJob;
/** @see https://github.com/nodejs/node/blob/main/lib/internal/modules/esm/module_map.js */
interface LoadCache extends Omit<Map<string, Dict<LoadCacheData>>, 'get' | 'set' | 'has'> {
  get(url: string, type?: string): LoadCacheData | undefined;
  set(url: string, type?: string, job?: LoadCacheData): this;
  has(url: string, type?: string): boolean;
}
/** Minimal Node internal ModuleWrap surface used by HMR helpers. */
interface ModuleWrap {
  url: string;
  getNamespace(): any;
}
/** @see https://github.com/nodejs/node/blob/main/lib/internal/modules/esm/module_job.js */
interface ModuleJob {
  url: string;
  loader: ModuleLoader;
  module?: ModuleWrap;
  importAttributes: ImportAttributes;
  linked: Promise<ModuleJob[]>;
  instantiate(): Promise<void>;
  run(): Promise<{
    module: ModuleWrap;
  }>;
}
/**
 * Node 22/23 ModuleLoader interface.
 *
 * Key methods:
 * - getModuleJobForImport(specifier, parentURL, importAttributes)
 * - resolve(specifier, parentURL, importAttributes) → Promise<ResolveResult>
 * - resolveSync(specifier, parentURL, importAttributes) → ResolveResult
 */
interface ModuleLoaderV1 {
  version: 'v1';
  loadCache: LoadCache;
  import(specifier: string, parentURL: string, importAttributes: ImportAttributes): Promise<any>;
  register(specifier: string | URL, parentURL?: string | URL, data?: any, transferList?: any[]): void;
  getModuleJobForImport(specifier: string, parentURL: string, importAttributes: ImportAttributes): Promise<ModuleJob>;
  resolve(specifier: string, parentURL: string, importAttributes: ImportAttributes): Promise<ResolveResult>;
  resolveSync(specifier: string, parentURL: string, importAttributes: ImportAttributes): ResolveResult;
  load(specifier: string, context: Pick<LoadHookContext, 'format' | 'importAttributes'>): Promise<LoadResult>;
}
/** Node 24+ module request object. */
interface ModuleRequest {
  specifier: string;
  attributes?: ImportAttributes;
  phase?: ModulePhase;
}
/** @see https://github.com/nodejs/node/blob/main/src/module_wrap.h */
declare const enum ModulePhase {
  Source = 1,
  Evaluation = 2
}
/** Opaque Node internal module request type marker. */
type ModuleRequestType = unknown;
/**
 * Node 24+ ModuleLoader interface.
 *
 * Breaking changes from v1:
 * - getModuleJobForImport removed → getOrCreateModuleJob(parentURL, request, requestType)
 * - resolve removed (became private #resolve) → resolveSync(parentURL, request)
 * - Parameter order reversed for resolveSync, request object { specifier, attributes }
 * - LoadCache became typed Map<url, { [type]: ModuleJob }> with delete only setting undefined
 */
interface ModuleLoaderV2 {
  version: 'v2';
  loadCache: LoadCache;
  import(specifier: string, parentURL: string, importAttributes: ImportAttributes, phase?: ModulePhase, isEntryPoint?: boolean): Promise<any>;
  register(specifier: string | URL, parentURL?: string | URL, data?: any, transferList?: any[], isInternal?: boolean): void;
  getOrCreateModuleJob(parentURL: string, request: ModuleRequest, requestType?: ModuleRequestType): Promise<ModuleJob>;
  resolveSync(parentURL: string, request: ModuleRequest): ResolveResult;
  load(url: string, context: Pick<LoadHookContext, 'format' | 'importAttributes'>): Promise<LoadResult>;
}
/** Supported Node internal ESM loader shapes. */
type ModuleLoader = ModuleLoaderV1 | ModuleLoaderV2;
/** Helpers for locating the current Node internal module loader. */
declare namespace ModuleLoader {
  function fromInternal(): ModuleLoader | undefined;
}
//#endregion
//#region ../../../vendor/loader/lib/types/config/tree.d.ts
/** Mutable tree of loader entries. Persistence is supplied by subclasses. */
declare abstract class EntryTree {
  static readonly sep = ":";
  ctx: Context;
  enableLogs?: boolean;
  root: EntryGroup;
  store: Dict<Entry>;
  constructor(ctx: Context);
  get context(): Context;
  /** Iterate entries in this tree and any nested subtrees. */
  entries(): Generator<Entry, void, void>;
  /** Return pending import and lifecycle tasks owned by this tree. */
  getTasks(): Promise<void>[];
  /**
   * Wait until this tree has no active import or lifecycle tasks.
   * @throws a settled fiber failure, or an aggregate when several fibers failed.
   */
  await(): Promise<void>;
  ensureId(options: Partial<EntryOptions>): string;
  /** Resolve an entry by id, including nested ids separated by `EntryTree.sep`. */
  resolve(id: string): Entry;
  resolveGroup(id: string | null): EntryGroup;
  /** Create an entry in the root group or a nested group. */
  create(options: Omit<EntryOptions, 'id'>, parent?: string | null, position?: number): Promise<string>;
  /** Stop and remove an entry from its parent group. */
  remove(id: string): Promise<void>;
  /** Update an entry and optionally move it to another group. */
  update(id: string, options: Omit<EntryOptions, 'id' | 'name'>, parent?: string | null, position?: number): Promise<void>;
  /** Import a plugin module from a specifier or `cordis:` builtin. */
  import(name: string, getOuterStack?: () => string[]): any;
  /** Persist current tree state. In-memory trees may implement this as a no-op. */
  abstract write(): void;
}
//#endregion
//#region ../../../vendor/loader/lib/types/config/group.d.ts
/** Runtime owner for a list of child loader entries. */
declare class EntryGroup {
  ctx: Context;
  tree: EntryTree;
  static readonly key: unique symbol;
  data: EntryOptions[];
  constructor(ctx: Context, tree: EntryTree);
  get context(): Context;
  create(options: Omit<EntryOptions, 'id'>): Promise<string>;
  unlink(options: EntryOptions): void;
  remove(id: string, isDispose?: boolean): Promise<void>;
  update(config: EntryOptions[]): Promise<void>;
  stop(): Promise<void>;
}
//#endregion
//#region ../../../vendor/loader/lib/types/config/entry.d.ts
/** Serialized plugin entry options stored in loader config files. */
interface EntryOptions {
  /** Stable id inside the containing entry tree. */
  id: string;
  /** Module specifier imported by the entry tree. */
  name: string;
  /** Config passed to the plugin. */
  config?: any;
  /** Marks this entry as a nested group. */
  group?: boolean | null;
  /** Prevents this entry and descendants from running. */
  disabled?: boolean | null;
  /** Required services or service intercept config for this entry. */
  inject?: Inject | null;
}
/** One configured plugin node inside an `EntryTree`. */
declare class Entry {
  loader: Loader;
  static readonly key: unique symbol;
  ctx: Context;
  fiber?: Fiber;
  parent: EntryGroup;
  options: EntryOptions;
  subgroup?: EntryGroup;
  subtree?: EntryTree;
  _initTask?: Promise<void>;
  _disposing: number;
  constructor(loader: Loader);
  get context(): Context;
  get id(): string;
  /** True when this entry or any owning parent entry is disabled. */
  get disabled(): boolean;
  private _disabled;
  /**
   * Effective disabled state: a `!!js` expression evaluates against the loader
   * context. The raw node stays in the options, so write-back keeps the form.
   */
  private disabledOf;
  evaluate(expr: string): any;
  private _patchContext;
  refresh(): Promise<void>;
  _dispose(fiber?: Fiber | undefined): Promise<void>;
  /** Merge new options, restart as needed, and persist through the parent tree. */
  update(options: Partial<EntryOptions>, create?: boolean, force?: boolean): Promise<void>;
  getOuterStack: () => string[];
  /** Import and start the configured plugin if it is not already running. */
  init(): Promise<void>;
  _await(): Promise<void>;
  private _init;
  private _start;
}
//#endregion
//#region ../../../vendor/loader/lib/types/config/isolate.d.ts
declare module './entry.ts' {
  interface EntryOptions {
    intercept?: Dict | null;
    isolate?: Dict<true | string> | null;
  }
  interface Entry {
    realm: LocalRealm;
  }
}
/** Symbol realm used to isolate service implementations by entry or label. */
declare abstract class Realm {
  protected store: Dict<symbol>;
  abstract get suffix(): string;
  access(key: string, create?: boolean): symbol;
  delete(key: string): void;
  get size(): number;
}
/** Entry-local isolation realm. */
declare class LocalRealm extends Realm {
  private entry;
  constructor(entry: Entry);
  get suffix(): string;
}
//#endregion
//#region ../../../vendor/loader/lib/types/index.d.ts
declare module '@deepseek-ai/cordis' {
  interface Events {
    'exit'(signal: NodeJS.Signals): Promise<void>;
    'loader/config-update'(): void;
    'loader/entry-init'(entry: Entry): void;
    'loader/partial-dispose'(entry: Entry, legacy: Partial<EntryOptions>, active: boolean): void;
    'loader/patch-context'(entry: Entry, next: () => void | Promise<void>): void | Promise<void>;
  }
  interface Context {
    loader: Loader;
  }
  interface EnvData {
    startTime?: number;
  }
  interface Fiber {
    entry?: Entry;
  }
}
/** Loader config and dependency intercept namespace. */
declare namespace Loader {
  /** Root loader configuration. */
  interface Config {
    /** Base URL used to resolve relative plugin specifiers and config paths. */
    baseUrl?: string;
  }
  /** Intercept config used when other plugins depend on `loader`. */
  interface Intercept {
    /** Keep dependent plugins pending while loader entries are still loading. */
    await?: boolean;
  }
}
/**
 * Service that owns a loader entry tree and imports configured plugins.
 *
 * Subclasses provide persistence by implementing `write()` on `EntryTree`.
 */
declare class Loader extends EntryTree {
  config: Loader.Config;
  [Service.config]: Loader.Intercept;
  envData: any;
  name: string;
  internal: ModuleLoader | undefined;
  builtins: Dict<any>;
  constructor(ctx: Context, config?: Loader.Config);
  write(): void;
  [Service.check](): boolean;
  showLog(entry: Entry, type: string): void;
  /** Return the loader entry id that owns `fiber`, if any. */
  locate(fiber?: Fiber): string | undefined;
  /** Hook for hosts that can restart the process on full-reload requests. */
  exit(): void;
  /** Normalize ESM/CJS/default export shapes before applying a plugin. */
  unwrapExports(exports: any): any;
}
//#endregion
//#region ../../boot/page-app-profile/lib/types/types.d.ts
/**
 * Host-safe page-app profile types. This module carries types only — no
 * runtime code — so the schema, path, serialization, journal, and lock
 * modules can share one contract without import cycles.
 * @module @deepseek-ai/dsh-page-app-profile/types
 */
/** How a managed package's source spec was stated at install time. */
type PageAppSourceKind = 'registry' | 'file' | 'link' | 'tarball' | 'git';
/** Redacted source record persisted in the registry; never carries credentials. */
interface PageAppRegistrySource {
  readonly kind: PageAppSourceKind;
  readonly display: string;
}
/** The manifest page fields every registry row echoes for its installed page. */
interface PageAppPageFields {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultOrder: number;
  readonly rootEntryId: string;
}
/** One owned page-app registry row (registry schema v1). */
interface PageAppRegistryEntry {
  readonly packageName: string;
  readonly source: PageAppRegistrySource;
  readonly resolvedVersion: string;
  readonly page: PageAppPageFields;
  readonly order: number;
  readonly enabled: boolean;
  readonly hidden: boolean;
  readonly installedAt: string;
  readonly updatedAt: string;
}
/** The sole ownership authority for one profile; schemaVersion is always 1. */
interface PageAppRegistryV1 {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly entries: readonly PageAppRegistryEntry[];
}
/** A parsed `dsh.workspace` manifest block joined with its owning package name. */
interface PageAppManifest {
  readonly packageName: string;
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultOrder: number;
  readonly rootEntryId: string;
}
//#endregion
//#region ../../boot/app-boot/lib/types/profile-runtime.d.ts
/** Immutable identity of the active profile the runtime manages. */
interface ActiveProfileIdentity {
  /** The profile name (its directory basename). */
  readonly name: string;
  /** Absolute profile directory. */
  readonly directory: string;
}
/** The manager's expectation for one Managed Root of the staged runtime layer. */
interface ExpectedManagedRoot {
  /** The registry row's package name. */
  readonly packageName: string;
  /** The registry row's page id. */
  readonly pageId: string;
  /** The root entry id the manager derived for this root. */
  readonly rootEntryId: string;
  /** {@link canonicalManagedRootHash} of the derived root entry. */
  readonly hash: string;
}
/** One acknowledged manager-layer generation request. */
interface ProfileRuntimeApplyRequest {
  /**
   * The registry revision the staged layer belongs to. Carried for the
   * manager's transaction validation (registry publication follows
   * acknowledgement, so the runtime does not compare it against the file).
   */
  readonly registryRevision: number;
  /**
   * The exact staged runtime-layer document. The runtime verifies the current
   * `runtime-layer.yml` content equals this string before recomposing, so an
   * apply can never acknowledge a layer that was not durably staged.
   */
  readonly runtimeLayer: string;
  /** Every Managed Root the staged layer is expected to mount. */
  readonly expectedRoots: readonly ExpectedManagedRoot[];
}
/** The acknowledged outcome of one manager-layer generation. */
interface ProfileRuntimeApplyResult {
  /** The manager-layer generation count after this apply (1 for the first). */
  readonly generation: number;
  /** Root entry ids of expected roots that are active in the settled tree. */
  readonly activeRoots: readonly string[];
  /**
   * Root entry ids whose effective composed row differs from the manager's
   * derived expectation (a user patch configured, disabled, or replaced the
   * row). The manager reports these as `externally-overridden` and never
   * rewrites the user's patch.
   */
  readonly externallyOverridden: readonly string[];
}
/** Why a registry root was omitted from the safe derived layer at startup. */
type ManagedRootOmissionReason = 'missing-dependency' | 'version-drift' | 'invalid-manifest' | 'missing-manager';
/** One root the safe derived layer omitted, with the reason. */
interface OmittedManagedRoot {
  /** The omitted root entry id. */
  readonly rootEntryId: string;
  /** Why the root is unsafe to mount. */
  readonly reason: ManagedRootOmissionReason;
}
/** Startup outcome of the manager runtime layer. */
interface ManagerLayerStartup {
  /**
   * Present when the registry is corrupt: managed roots failed closed, the
   * corrupt registry is preserved, and the manager exposes this recovery
   * error.
   */
  readonly recoveryError?: string;
  /** Roots omitted from the regenerated layer as unsafe. */
  readonly omitted: readonly OmittedManagedRoot[];
}
/**
 * Startup preparation of the manager runtime layer: regenerate a missing,
 * corrupt, or stale derived layer from a valid registry, or fail managed
 * roots closed when the registry is corrupt. The whole derive-and-commit
 * cycle runs inside the shared profile operation lock (Task 1's
 * `withPageAppProfileLock`, after the same package's lock recovery so a
 * crashed owner cannot stall boot), the registry revision/content is
 * re-verified immediately before commit, and the layer is published through
 * the atomic writer (same-directory temp file plus atomic rename), so a
 * concurrent manager publication is never overwritten by this stale startup
 * and no reader can observe a partial layer. When the registry is corrupt it
 * is preserved while any stale layer is removed so no orphaned managed roots
 * can mount, and the recovery error is returned for the manager to expose.
 * When no registry exists the registry — the ownership authority — says
 * nothing is managed: any existing layer is an orphan and is removed (an
 * absent registry is a normal not-yet-managed state, not a recovery error).
 * @param binName - the diagnostic prefix on parse errors.
 * @param profileDir - absolute profile directory.
 * @returns the startup outcome: recovery error (corrupt registry) and the
 * omitted unsafe roots of the regenerated layer.
 */
declare function prepareManagerRuntimeLayer(binName: string, profileDir: string, ownerPackageName?: string): Promise<ManagerLayerStartup>;
/** Options for constructing a {@link ProfileRuntime}. */
interface ProfileRuntimeOptions {
  /** The immutable active-profile identity. */
  readonly identity: ActiveProfileIdentity;
  /** Package that owns the wrapper export (the official manager by default). */
  readonly ownerPackageName?: string;
  /**
   * Build one fresh full-generation patch list from the given manager layer
   * patches (bundles → manager → profile → home → overlays); every
   * generation gets a fresh structured clone.
   */
  readonly compose: (managerPatches: readonly PatchOptions[]) => readonly PatchOptions[];
  /**
   * The boot-time acknowledged manager layer snapshot — exactly the patches
   * the initial composition mounted. Watcher generations compose this
   * snapshot until a manager-layer apply/restore audit promotes a new one.
   */
  readonly initialManagerPatches: readonly PatchOptions[];
  /**
   * Launcher-owned user-patch files routed through the serialized queue.
   * Consumed internally when the tree settles (after the boot activation
   * audit): the runtime ensures an HMR service and registers one watcher per
   * path that recomposes the acknowledged snapshot. The public watcher API
   * deliberately has no runtime-routing option, so this configuration is the
   * only way a watcher reaches the queue.
   */
  readonly watchPatches?: readonly {
    binName: string;
    filename: string;
  }[];
  /** Startup recovery error when the registry is corrupt; managed roots failed closed. */
  readonly recoveryError?: string;
  /** Roots the safe derived layer omitted at startup, with their reasons. */
  readonly omittedRoots?: readonly OmittedManagedRoot[];
}
/**
 * Launcher-provided Cordis service owning the acknowledged profile
 * recomposition. The manager plugin injects it (by {@link PROFILE_RUNTIME_SERVICE})
 * and calls {@link ProfileRuntime.applyManagerLayer} /
 * {@link ProfileRuntime.restoreManagerLayer}; each call composes one fresh
 * generation, applies it through the root Include's transactional update,
 * waits for the Loader to settle, audits that every expected root reached
 * active state, and resolves with the acknowledged generation only after the
 * audit passes. All state lives in the module-private state registry keyed by
 * the raw instance, so this object itself carries no own enumerable or
 * writable properties beyond the Cordis service base fields — a consumer can
 * replace neither the identity nor any launcher-controlled value. The
 * user-patch watchers route their generations through the same serialized
 * queue via the boot-only control, so no independent `entry.update` writers
 * can race. A call before the root Include is bound or before the initial
 * tree has settled fails loudly; the manager may inject the service during
 * boot but cannot mutate until then.
 */
declare class ProfileRuntime extends Service {
  constructor(ctx: Context, options: ProfileRuntimeOptions);
  /** The immutable active-profile identity; consumers cannot replace it. */
  get identity(): ActiveProfileIdentity;
  /** Package identity that owns the Feature Runtime Wrapper export. */
  get ownerPackageName(): string;
  /** Startup recovery error when the registry is corrupt; managed roots failed closed. */
  get recoveryError(): string | undefined;
  /** Roots the safe derived layer omitted at startup, with their reasons. */
  get omittedRoots(): readonly OmittedManagedRoot[];
  /**
   * Acknowledge one staged manager-layer generation; see
   * {@link ProfileRuntimeState.applyManagerLayer} for the full contract.
   * @param request - the staged layer and its expected roots.
   * @returns the acknowledged generation with active roots and overrides.
   */
  applyManagerLayer(request: ProfileRuntimeApplyRequest): Promise<ProfileRuntimeApplyResult>;
  /**
   * Restore a prior manager-layer generation (the rollback path); see
   * {@link ProfileRuntimeState.restoreManagerLayer} for the full contract.
   * @param request - the restored layer and its expected roots.
   * @returns the acknowledged generation with active roots and overrides.
   */
  restoreManagerLayer(request: ProfileRuntimeApplyRequest): Promise<ProfileRuntimeApplyResult>;
}
//#endregion
export { prepareManagerRuntimeLayer as a, PageAppSourceKind as c, ProfileRuntimeApplyResult as i, EntryOptions as l, ProfileRuntime as n, PageAppManifest as o, ProfileRuntimeApplyRequest as r, PageAppRegistryV1 as s, ExpectedManagedRoot as t };