import { ReactNode } from "react";
import { Context, Service } from "@deepseek-ai/cordis";
import { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";

//#region ../ui-slots/lib/types/renderer.d.ts
/** Minimal observable API for host-provided standard-kit data sources. */
interface HostObservable<T> {
  getSnapshot(): T;
  subscribe(fn: () => void): () => void;
}
//#endregion
//#region ../ui-slots/lib/types/store.d.ts
/** Framework-neutral store contracts for slot registrations and the runtime engine. */
/**
 * Typed selector hook over a snapshot source. Canonical shape for the whole
 * slot system (ui-renderer's engine hook is structurally identical; the
 * framework is the only party that ever constructs one).
 */
type SnapshotSelectorHook<T> = <S>(sel: (s: T) => S, eq?: (a: S, b: S) => boolean) => S;
/**
 * Action declaration table: pure immer-draft transforms over the store state,
 * declared as the store's complete write set (the audit face — components can
 * only write through these).
 */
type ActionsDecl<T> = Record<string, (draft: T, ...params: any[]) => void>;
/**
 * Draft-stripped callback form of an actions table: what components
 * (`props.actions`) and inject factories receive — the framework bakes the
 * draft parameter away by binding each action to the resolved instance.
 */
type BakedActions<T, A extends ActionsDecl<T>> = { [K in keyof A]: A[K] extends ((draft: T, ...params: infer P) => void) ? (...params: P) => void : never };
/**
 * Store declaration spec: initial-state factory (a lambda so every instance
 * gets a fresh state), optional persistence key (mechanical, framework-run),
 * and the actions write set.
 */
interface StoreSpec<T, A extends ActionsDecl<T>> {
  init: () => T;
  persist?: string;
  actions: A;
}
/**
 * Live engine instance: the create() product consumed by the render machinery
 * and by tests. A bare snapshot source plus the baked write set — no React
 * hook rides the engine product (the engine lives in the React-free runtime);
 * the render machinery binds the `useStore` hook from this source on its own
 * side, cached per instance. Production components and render paths never
 * call create() themselves — instance lifecycle is the framework's.
 */
interface StoreInstance<T, A extends ActionsDecl<T>> {
  readonly actions: BakedActions<T, A>;
  getSnapshot(): T;
  /**
   * Subscribe to state changes (uSES subscribe side).
   * @param fn - change callback.
   * @returns unsubscribe.
   */
  subscribe(fn: () => void): () => void;
  /**
   * Drop this instance's persisted value (no-op for non-persist specs). The
   * framework calls it when the owning scope dies for good — a pruned session
   * must not leave orphaned storage keys behind.
   */
  clearPersisted(): void;
}
/**
 * Store handle: spec + state/actions types + shared identity + instance
 * factory in one value. Handles are constructed in apply world (shared across
 * registrations of one plugin) or by the framework from a registrant's
 * factory (exclusive). Never export a handle at module level — module-cache
 * identity is a disguised singleton across plugin reloads.
 */
interface StoreHandle<T, A extends ActionsDecl<T>> {
  readonly spec: StoreSpec<T, A>;
  /**
   * Create a live engine instance (framework machinery and tests only).
   * @param scopeKey - session id for session-scope instances; suffixes the
   * persist key so per-session instances persist independently (root-scope
   * instances omit it).
   * @returns a fresh instance seeded from `spec.init()`.
   */
  create(scopeKey?: string): StoreInstance<T, A>;
}
/**
 * Exclusive-store registration form: the registrant passes the factory itself
 * and the framework calls it per entry x scope (no shared identity exists).
 */
type StoreFactory = () => StoreHandle<any, any>;
/** The register `store` option position: a shared handle or an exclusive factory. */
type StoreDecl = StoreHandle<any, any> | StoreFactory;
//#endregion
//#region ../ui-slots/lib/types/index.d.ts
/** Slot contract table. Owners extend via declaration merging; entries are {@link SlotEntryDef}. */
interface SlotMap {}
/**
 * Locale namespace table. Dictionary owners extend via declaration merging
 * (exactly like {@link SlotMap}, and declared in this entry module for the
 * same lexical-merge reason): the key is the namespace string, the value is
 * the union of its dictionary keys. Register sites declare one of these
 * namespaces (`locale:`), which puts the typed `t` standard seat on the
 * component props.
 */
interface LocaleNamespaceMap {}
/**
 * Translate a dictionary key with optional `{name}` template params.
 * `K` narrows the accepted keys to the owning namespace's dictionary union
 * (plus the shared common vocabulary where composed).
 */
type Translate<K extends string = string> = (key: K, params?: Record<string, unknown>) => string;
/**
 * The shared `common` vocabulary keys as merged by the locale plugin;
 * resolves to `never` in programs without the merge (this package's tests),
 * keeping the union collapse harmless.
 */
type CommonKeyOf = LocaleNamespaceMap extends {
  common: infer C;
} ? C & string : never;
/**
 * Key domain of a namespace-bound translate: the namespace's own dictionary
 * union plus the shared common vocabulary (the lookup chain consults common
 * after the namespace misses).
 */
type LocaleKeysOf<N extends keyof LocaleNamespaceMap & string> = (LocaleNamespaceMap[N] & string) | CommonKeyOf;
/**
 * Namespace-addressed translate — the developer-facing alias over
 * {@link Translate}: `TranslateNS<'model'>` is the translate function of the
 * `model` namespace (key domain = its dictionary union plus the shared
 * common vocabulary), the exact type of the framework-injected `t` seat and
 * of the locale service's typed `bind`.
 */
type TranslateNS<N extends keyof LocaleNamespaceMap & string> = Translate<LocaleKeysOf<N>>;
/**
 * Locale share of the composed component props: the framework-injected `t`
 * seat, present exactly on entries whose registration declares `locale:`.
 */
type PropsLocale<N> = N extends keyof LocaleNamespaceMap & string ? {
  /** Translate a dictionary key of the declared namespace (or the shared common vocabulary). */t: TranslateNS<N>;
} : object;
/** Slot cardinality: single occupant, ordered list, key-dispatched, or selector-routed chain. */
type SlotKind = 'single' | 'list' | 'keyed' | 'chain';
/** Slot data context: global, current-session-optional, or strict session-bound. */
type SlotScope = 'root' | 'session-maybe' | 'session';
/**
 * One SlotMap entry: kind/scope axes plus the optional owner-supplied props
 * share (`owner` is what the parent passes at its renderSlot call site; the
 * framework standard kit and the registrant's injected share never enter this
 * table — full component props compose at the component as the four-share
 * intersection, see {@link ComposedProps}).
 */
interface SlotEntryDef {
  kind: SlotKind;
  scope: SlotScope;
  owner?: object;
  /**
   * Optional keyed-entry prop table. A keyed registration contributes one
   * literal key and receives the corresponding prop share; ordinary owner
   * props remain common to every key.
   */
  keyProps?: Record<string, object>;
  /**
   * Optional opaque context carried by one renderSlot occurrence. Only
   * function-valued members of the slot-level injected hooks compartment
   * receive it; the slot machinery never interprets the value.
   */
  hookContext?: unknown;
  /**
   * Optional Slot-level inject face supplied by the parent registration's
   * child declaration. Every registered entry receives its bound component
   * face; child registrants do not own or replace this common capability.
   */
  inject?: object;
}
/**
 * Runtime dispatch spec for one slot, recorded from a register call's
 * `children` value. The literal is compile-time checked against the SlotMap
 * entry (`SlotSpec<SlotMap[P]>` in {@link ChildrenDecl}), so kind, scope, and
 * any common inject face are declared at one point and validate each other.
 */
type SlotSpec<E extends SlotEntryDef> = {
  kind: E['kind'];
  scope: E['scope'];
} & ('inject' extends keyof E ? E extends {
  inject: infer Injected extends object;
} ? {
  inject: Injected;
} : {
  inject?: object;
} : {
  inject?: never;
});
/** Owner-supplied props share for a slot key ({} for entries declaring no `owner`). */
type OwnerOf<K extends keyof SlotMap & string> = SlotMap[K] extends {
  owner: infer O extends object;
} ? O : object;
/** Registration/dispatch key domain of one keyed slot. */
type EntryKeyOf<K extends keyof SlotMap & string> = SlotMap[K] extends {
  kind: 'keyed';
  keyProps: infer P extends object;
} ? keyof P & string : string;
/** Key-dependent props supplied by the owner at one keyed dispatch site. */
type KeyPropsOf<K extends keyof SlotMap & string, EntryKey extends EntryKeyOf<K>> = SlotMap[K] extends {
  kind: 'keyed';
  keyProps: infer P extends object;
} ? EntryKey extends keyof P ? P[EntryKey] extends object ? P[EntryKey] : never : never : object;
/** Opaque per-render occurrence context declared by one slot. */
type HookContextOf<K extends keyof SlotMap & string> = SlotMap[K] extends {
  hookContext: infer Context;
} ? Context : never;
/** Common render-occurrence inject face declared by one slot. */
type SlotInjectOf<K extends keyof SlotMap & string> = SlotMap[K] extends {
  inject: infer Injected extends object;
} ? Injected : object;
/** Scope axis of a slot key's SlotMap entry. */
type ScopeOf<K extends keyof SlotMap & string> = SlotMap[K]['scope'];
/**
 * Framework standard kit delivered to every session-scope slot component.
 * Declared EMPTY here (zero-dependency layer): the runtime package merges the
 * real members (`useSession` bound to the conversation snapshot and the
 * framework-supplied `sessionId`) exactly as consumers merge SlotMap keys.
 */
interface SessionStandardProps {}
/**
 * Framework standard kit delivered to current-session-optional slots. Its
 * hooks stay callable while no session is selected and return `undefined`
 * until one becomes current; concrete members merge in at runtime packages.
 */
interface SessionMaybeStandardProps {}
/**
 * Framework standard kit delivered to EVERY slot component (the global seat).
 * Declared empty here; the runtime package merges the global object-layer
 * selector hooks that shared page composition consumes.
 */
interface GlobalStandardProps {}
/**
 * The session id type as the runtime's SessionStandardProps merge declares it
 * (branded); falls back to `string` in programs without the merge (this
 * package's own tests).
 */
type SessionIdOf = SessionStandardProps extends {
  sessionId: infer S;
} ? S : string;
/**
 * Runtime props share for a slot key: owner share (parent's renderSlot call
 * site) + session standard kit (session scope only) + the global seat.
 */
type PropsRuntime<K extends keyof SlotMap & string, EntryKey extends EntryKeyOf<K> = EntryKeyOf<K>> = OwnerOf<K> & KeyPropsOf<K, EntryKey> & SlotInjectFace<SlotInjectOf<K>> & (ScopeOf<K> extends 'session' ? SessionStandardProps : ScopeOf<K> extends 'session-maybe' ? SessionMaybeStandardProps : object) & GlobalStandardProps;
/** renderSlot dispatch options: keyed dispatch key, list filtering, and empty fallback. */
interface RenderOpts<EntryKey extends string = string> {
  entryKey?: EntryKey;
  only?: string;
  fallback?: ReactNode;
  /** Type-erased runtime seat; PropsRenderSlots narrows or removes it per slot declaration. */
  hookContext?: unknown;
}
/** renderSlotChain dispatch options. */
interface ChainRenderOpts {
  /** The owner's fallback body, rendered when every entry's selector declines. */
  fallback?: ReactNode;
  /**
   * Keep the fallback permanently mounted: an election hides it (wrapped,
   * display:none) instead of unmounting it, and the all-decline case shows it
   * as-is — fallback-held state (composer drafts, DOM state) survives a
   * takeover. Chain kind only. Sole consumer today: the
   * 'conversation.composer' chain.
   */
  overlay?: boolean;
}
/** Keys of a slot-key union whose SlotMap entry is chain-kind (renderSlotChain's dispatch domain). */
type ChainKeysOf<S extends keyof SlotMap & string> = S extends unknown ? (SlotMap[S]['kind'] extends 'chain' ? S : never) : never;
/** Keys in a render share whose dispatch occurrence requires hookContext. */
type ContextualKeysOf<S extends keyof SlotMap & string> = S extends unknown ? (SlotMap[S] extends {
  hookContext: unknown;
} ? S : never) : never;
/** Keys in a render share with the ordinary optional options bag. */
type OrdinaryKeysOf<S extends keyof SlotMap & string> = Exclude<S, ContextualKeysOf<S>>;
/**
 * Plain and contextual child dispatch signatures. Keeping them as separate
 * call signatures preserves ordinary renderSlot assignability while making a
 * declared hookContext mandatory only for the Slot keys that need it.
 */
type RenderSlotFn<S extends keyof SlotMap & string> = ([ContextualKeysOf<S>] extends [never] ? object : {
  <K extends ContextualKeysOf<S>, EntryKey extends EntryKeyOf<K> = EntryKeyOf<K>>(key: K, owner: OwnerOf<K> & KeyPropsOf<K, NoInfer<EntryKey>>, opts: RenderOpts<EntryKey> & {
    hookContext: HookContextOf<K>;
  }): ReactNode;
}) & ([OrdinaryKeysOf<S>] extends [never] ? object : {
  <K extends OrdinaryKeysOf<S>, EntryKey extends EntryKeyOf<K> = EntryKeyOf<K>>(key: K, owner: OwnerOf<K> & KeyPropsOf<K, NoInfer<EntryKey>>, opts?: Omit<RenderOpts<EntryKey>, 'hookContext'>): ReactNode;
});
/**
 * Chain matched share: a chain-slot component receives its selector's
 * non-null result as the framework-injected `matched` prop; other kinds add
 * nothing to the composed constraint.
 */
/** Props of the standard-kit SessionProvider seat (render-prop form). */
interface SessionAreaProps {
  /** No-session body (also covers a current id whose session cannot be resolved). */
  empty?: (() => ReactNode) | undefined;
  /** Session body; the framework remounts it per session (key=sessionId). */
  children: (sessionId: SessionIdOf) => ReactNode;
}
/**
 * Framework-wired session area component. It subscribes to runtime-owned
 * session selection and is injected into entries that declare session-scoped
 * children; business code does not import it directly.
 */
type SessionProviderComponent = (props: SessionAreaProps) => ReactNode;
/**
 * Child-slot render share: `renderSlot` statically narrowed to the entry's
 * declared children keys. Delegation is plain props passing (hand
 * `props.renderSlot` down); the authorizing identity stays the registering
 * entry. `__renders` is a phantom variance anchor (never materialized):
 * generic method signatures compare loosely across differing key unions, so
 * this contravariant marker is what actually enforces "component key set ⊆
 * children declaration" at the register call site.
 */
type PropsRenderSlots<S extends keyof SlotMap & string> = {
  /**
   * Render a declared non-chain child slot (chain keys dispatch through
   * `renderSlotChain` — their routing lives in entry selectors).
   * @param key - declared child key.
   * @param owner - owner props share for that key (decided at the render site).
   * @param opts - kind dispatch options.
   * @returns rendered node(s).
   */
  renderSlot: RenderSlotFn<Exclude<S, ChainKeysOf<S>>>;
  readonly __renders?: ((key: S) => void) | undefined;
} & ([ChainKeysOf<S>] extends [never] ? object : {
  /**
   * Render a declared chain child slot: entry selectors run in chain order
   * over `owner`; the first non-null match renders its component with the
   * selector result injected as `matched`; all-null renders `opts.fallback`.
   * @param key - declared chain child key.
   * @param owner - owner props share (the selectors' routing input).
   * @param opts - fallback body for the all-null case.
   * @returns rendered node(s).
   */
  renderSlotChain: <K extends ChainKeysOf<S>>(key: K, owner: OwnerOf<K>, opts?: ChainRenderOpts) => ReactNode;
}) & ('session' extends ScopeOf<S> ? {
  SessionProvider: SessionProviderComponent;
} : object);
/**
 * Registrant hooks compartment: bare observable sources (getSnapshot +
 * subscribe pairs) supplied under the reserved `hooks` key of an entry's
 * inject face. These retain the original source-to-selector binding and do
 * not participate in render-occurrence context.
 */
type HooksSources = Record<string, HostObservable<unknown>>;
/** Component-side Hook produced from one slot-level inject.hooks member. */
type BoundHookOf<Definition> = Definition extends HostObservable<infer Snapshot> ? SnapshotSelectorHook<Snapshot> : Definition extends ((...args: never[]) => infer Hook) ? Hook extends ((...args: never[]) => unknown) ? Hook : never : never;
/**
 * Selector-hook share synthesized from a hooks compartment: each source
 * `name` becomes a `use<Name>` selector hook over its snapshot type.
 */
type PropsSlotHooks<HS extends object> = { [N in keyof HS & string as `use${Capitalize<N>}`]: BoundHookOf<HS[N]> };
/** Component-side view of a slot dispatcher's common inject face. */
type SlotInjectFace<I extends object> = I extends {
  hooks: infer HS extends object;
} ? Omit<I, 'hooks'> & PropsSlotHooks<HS> : I;
/** Selector-hook share synthesized from an entry inject hooks compartment. */
type PropsHooks<HS extends HooksSources> = { [N in keyof HS & string as `use${Capitalize<N>}`]: SnapshotSelectorHook<HS[N] extends HostObservable<infer T> ? T : never> };
/**
 * The component-side view of an inject face: the reserved `hooks`
 * compartment (when declared) arrives as bound `use<Name>` selector hooks;
 * every other member passes through verbatim.
 */
type InjectFace<I extends object> = I extends {
  hooks: infer HS extends HooksSources;
} ? Omit<I, 'hooks'> & PropsHooks<HS> : I;
/**
 * A list-entry display label: a plain string, or a thunk re-evaluated per
 * read so registration-time text (nav rows, tabs) follows the active locale
 * without re-registration. Owners resolve through {@link resolveSlotLabel}.
 */
type SlotLabel = string | (() => string);
/**
 * One stored registration, as recorded by the core and read by the render
 * machinery (type-erased at this boundary; the registration contract already proved
 * the shares against the component).
 */
interface StoredEntry {
  component: unknown;
  options: {
    key?: string;
    id?: string;
    order?: number;
    label?: SlotLabel;
    priority?: number;
  };
  /** Chain routing selector (type-erased like `inject`; present exactly on chain-slot entries). */
  select?: ((owner: never) => unknown) | undefined;
  /** Registrant business face; positional params derive from the declaration (sessionId?, actions?). */
  inject?: ((...args: never[]) => Record<string, unknown>) | undefined;
  /** Child-slot declaration table (declaration + authorization + runtime spec in one). */
  children?: Readonly<Record<string, SlotSpec<SlotEntryDef>>> | undefined;
  /** Declared store seat (instance resolution and lifecycle live with the host machinery). */
  store?: StoreDecl | undefined;
  /** Declared dictionary namespace (the render machinery synthesizes the `t` seat from it). */
  locale?: string | undefined;
  /** Diagnostics label of who registered. */
  registrant?: string | undefined;
  /**
   * Immutable caller provenance: the package name of the Loader entry whose
   * fiber registered this entry, derived by the runtime Service from the
   * caller's `fiber.entry.options.name` (a trailing `/client` normalized away).
   * Output-only — registration options can never carry or override it, and it
   * stays separate from the {@link StoredEntry.registrant} diagnostics label.
   */
  ownerPackage?: string | undefined;
}
//#endregion
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
//#region ../../host/page-app-manager/lib/types/types.d.ts
/** How a managed package's source spec was stated at install time (wire copy). */
type PageAppSourceKind = 'registry' | 'file' | 'link' | 'tarball' | 'git';
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
//#region lib/types/client/contracts.d.ts
/** The Remote result envelope the generated namespace returns. */
type PageAppRemoteResult<T> = {
  readonly ok: true;
  readonly value: T;
} | {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
};
/** The generated `pageAppManager` namespace methods the controller calls. */
interface PageAppManagerRemoteMethods {
  list(): Promise<PageAppRemoteResult<PageAppManagerSnapshot>>;
  installPackage(source: PageAppInstallSource, clientInstanceId: PageAppClientInstanceId, signal: AbortSignal): Promise<PageAppRemoteResult<number>>;
  setEnabled(pageId: string, enabled: boolean, signal: AbortSignal): Promise<PageAppRemoteResult<number>>;
  setHidden(pageId: string, hidden: boolean): Promise<PageAppRemoteResult<number>>;
  reorder(pageIds: readonly string[]): Promise<PageAppRemoteResult<number>>;
  uninstall(pageId: string, signal: AbortSignal): Promise<PageAppRemoteResult<number>>;
  ackClientActivation(transactionId: PageAppTransactionId, clientInstanceId: PageAppClientInstanceId, packageName: string, pageId: string, graphRevision: string): Promise<PageAppRemoteResult<{
    accepted: boolean;
    reason?: string;
  }>>;
  recover(): Promise<PageAppRemoteResult<{
    action: string;
    message?: string;
  }>>;
}
/** The forwarded lifecycle events the controller subscribes to. */
interface PageAppRemoteEvents {
  $on(event: 'page-app-manager/changed', listener: (revision: number) => void): () => void;
  $on(event: 'page-app-manager/activation-requested', listener: (request: PageAppActivationRequestedEvent) => void): () => void;
}
/** The slot ledger surface the controller projects eligible contributions from. */
interface PageAppSlotsSeam {
  /** Live entries of one slot key. */
  entries(key: string): readonly StoredEntry[];
  /** Subscribe to one slot key's registration changes. */
  subscribe(key: string, fn: () => void): () => void;
  /** Observe every slot mutation (any key). */
  onMutate(fn: (key: string) => void): () => void;
}
/**
 * The renderable view of one pending targeted activation (spec §7.2): the
 * shell/Settings show which package and page are activating and whether the
 * client graph already converged to the announced revision.
 */
interface PageAppActivationView {
  /** The transaction the activation belongs to. */
  readonly transactionId: PageAppTransactionId;
  /** The installed package name. */
  readonly packageName: string;
  /** The managed page id. */
  readonly pageId: string;
  /** The graph revision the client must have converged to. */
  readonly graphRevision: string;
  /** Whether this client graph already converged to the announced revision. */
  readonly converged: boolean;
}
/** The surface slot key managed packages contribute into (spec §6.1). */
declare const PAGE_APP_SURFACE_SLOT = "page-app.shell.surface";
/** The built-in DSH page id (shell-owned fallback surface; never a registry row). */
declare const PAGE_APP_DSH_PAGE = "dsh";
/** Owner share of the built-in DSH seat (the shell supplies nothing). */
interface PageAppBuiltinOwner {
  /** Marker field: builtin owner props are intentionally empty. */
  children?: never;
}
/** Owner share of one managed surface (the shell supplies nothing). */
interface PageAppSurfaceOwner {
  /** Marker field: surface owner props are intentionally empty. */
  children?: never;
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * The built-in Original DSH seat: the one permanent system surface that
     * the shell mounts unconditionally and hides (never unmounts) while a
     * managed surface is active. OCCUPIED by ui-layout's AppFrame.
     */
    'page-app.shell.builtin': {
      kind: 'single';
      scope: 'root';
      owner: PageAppBuiltinOwner;
    };
    /**
     * One full-page managed surface per keyed page id. OCCUPIED by managed
     * packages after runtime activation; the closed authorization projection
     * (spec §7) keeps unrelated contributions invisible.
     */
    'page-app.shell.surface': {
      kind: 'keyed';
      scope: 'root';
      owner: PageAppSurfaceOwner;
      key: string;
    };
  }
} //# sourceMappingURL=contracts.d.ts.map
//#endregion
//#region lib/types/client/stores.d.ts
/**
 * Bare observable primitive for the page-app client controller: a stable
 * getSnapshot/subscribe pair with no React dependency. React binding arrives
 * through the slot renderer's `inject.hooks` compartment (Task 11), which
 * hands the observable to uSES — the methods are arrow-class fields so they
 * stay `this`-safe even when passed as bare references.
 * @module @deepseek-ai/dsh-client-ui-page-app-manager/client/stores
 */
/** One observable value: stable snapshot reference between changes. */
interface PageAppObservable<T> {
  /** Current value; the same reference until a committed change. */
  getSnapshot(): T;
  /**
   * Observe committed changes (post-notification snapshots are current).
   * @param fn - change callback.
   * @returns unsubscribe.
   */
  subscribe(fn: () => void): () => void;
}
/**
 * Mutable observable cell: set() commits a new value and notifies listeners
 * only when the reference changed, so getSnapshot() stays a valid uSES-style
 * source.
 */
declare class MutableObservable<T> implements PageAppObservable<T> {
  private value;
  private readonly listeners;
  /**
   * @param value - the initial value.
   */
  constructor(value: T);
  /** The current value (stable until set()). */
  getSnapshot: () => T;
  /**
   * Commit a new value. Notifies listeners exactly when the reference changes.
   * @param next - the new value.
   */
  set: (next: T) => void;
  /**
   * Observe committed changes.
   * @param fn - change callback.
   * @returns unsubscribe.
   */
  subscribe: (fn: () => void) => () => void;
}
//#endregion
//#region lib/types/client/controller.d.ts
/** The controller's durable projection (stable reference between committed changes). */
interface PageAppClientSnapshot {
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
interface PageAppControllerDeps {
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
declare class PageAppController {
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
//#endregion
//#region lib/types/client/workbench.d.ts
/** The injection service name for the client Workbench bridge. */
declare const WORKBENCH_CLIENT_SERVICE = "workbench";
/** One contract-v1 workspace surface registration. */
interface WorkbenchSurfaceRegistration {
  /** The managed page id; it becomes the keyed surface slot key. */
  readonly pageId: string;
  /** The owning Feature package name, retained for its contract provenance. */
  readonly packageName: string;
  /** The Feature's render component. */
  readonly render: unknown;
  /** Optional stable display order among managed surfaces. */
  readonly order?: number;
}
/** The intentionally narrow client face injected into a Workspace App Feature. */
interface WorkbenchClientBridge {
  /** Feature-lifetime cleanup registration. */
  readonly lifecycle: {
    /** Register one callback that releases with the calling Feature fiber. */onDispose(callback: () => void): () => void;
  };
  /** The sole workspace-surface contribution entry. */
  readonly surfaces: {
    /** Register one keyed managed surface owned by the calling Feature. */registerWorkspaceSurface(registration: WorkbenchSurfaceRegistration): () => void;
  };
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Caller-bound Workbench Contract v1 bridge for Workspace App Features. */
    workbench: WorkbenchClientBridge;
  }
}
/**
 * Manager-owned service that materializes a Feature-bound contract face on
 * every caller access. Service getter binding is intentional: Cordis proxies
 * `this.ctx` to the consumer fiber, so both slot registration and lifecycle
 * release belong to that Feature rather than this manager's fiber.
 */
declare class WorkbenchClientBridgeService extends Service {
  /** The lifecycle compartment for the calling Feature. */
  get lifecycle(): WorkbenchClientBridge['lifecycle'];
  /** The surface-registration compartment for the calling Feature. */
  get surfaces(): WorkbenchClientBridge['surfaces'];
  /**
   * Build one stable-enough plain contract face over the current caller
   * context. The face is captured in a registered entry's inject callback, so
   * React receives the same Feature-bound lifetime bridge after registration.
   */
  private faceForCaller;
  /** Provide the bridge under the stable feature injection name. */
  constructor(ctx: Context);
}
//#endregion
//#region lib/types/client/locales.d.ts
/** Copy dictionaries for the Workspace Apps settings tab. */
/** Simplified Chinese dictionary and key source of truth. */
declare const zh: {
  tab: string;
  profile: string;
  add: string;
  addPlaceholder: string;
  addAction: string;
  addProgress: string;
  addError: string;
  empty: string;
  rows: string;
  info: string;
  disable: string;
  enable: string;
  hide: string;
  show: string;
  uninstall: string;
  uninstallConfirm: string;
  surfaceCrashed: string;
  retry: string;
  cancelInstall: string;
  uninstallProgress: string;
  recoveryAction: string;
  recoveryMessage: string;
  operationProgress: string;
  active: string;
  disabledState: string;
  hiddenState: string;
  ready: string;
  missingDependency: string;
  versionDrift: string;
  invalidManifest: string;
  activationFailed: string;
  externallyOverridden: string;
  recoveryRequired: string;
  operationInstalling: string;
  operationActive: string;
  operationRemoving: string;
  operationInstallFailed: string;
  operationRemoveFailed: string;
  orderLabel: string;
  visibleLabel: string;
  noProfile: string;
  cancel: string;
  close: string;
};
/** Workspace Apps settings locale key union. */
type PageAppSettingsKey = keyof typeof zh;
/** English dictionary checked against the Chinese key set. */
declare const en: {
  tab: string;
  profile: string;
  add: string;
  addPlaceholder: string;
  addAction: string;
  addProgress: string;
  addError: string;
  empty: string;
  rows: string;
  info: string;
  disable: string;
  enable: string;
  hide: string;
  show: string;
  uninstall: string;
  uninstallConfirm: string;
  surfaceCrashed: string;
  retry: string;
  cancelInstall: string;
  uninstallProgress: string;
  recoveryAction: string;
  recoveryMessage: string;
  operationProgress: string;
  active: string;
  disabledState: string;
  hiddenState: string;
  ready: string;
  missingDependency: string;
  versionDrift: string;
  invalidManifest: string;
  activationFailed: string;
  externallyOverridden: string;
  recoveryRequired: string;
  operationInstalling: string;
  operationActive: string;
  operationRemoving: string;
  operationInstallFailed: string;
  operationRemoveFailed: string;
  orderLabel: string;
  visibleLabel: string;
  noProfile: string;
  cancel: string;
  close: string;
};
//#endregion
//#region lib/types/client/apply.d.ts
/** Dictionary namespace owned by this plugin (Workspace Apps settings copy). */
declare const NS = "settings.pageApp";
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Workspace Apps settings tab copy. */
    'settings.pageApp': PageAppSettingsKey;
  }
}
/** Required services: the slot registry and the locale face (remote/modules are read defensively). */
declare const inject: string[];
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
declare function apply(ctx: ClientContext): Promise<void>;
//#endregion
//#region lib/types/client/PageAppShell.d.ts
/** The controller face the manager apply() hands to the shell registration. */
interface PageAppShellInjected {
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
type PageAppShellProps = PropsRuntime<'root'> & PropsRenderSlots<'page-app.shell.builtin' | 'page-app.shell.surface'> & PropsLocale<'settings.pageApp'> & InjectFace<PageAppShellInjected>;
/** The root Workspace App shell (see module doc). */
declare function PageAppShell({
  usePageApp,
  select,
  uninstall,
  t,
  renderSlot
}: PageAppShellProps): import("react").JSX.Element;
//#endregion
//#region lib/types/client/PageAppRail.d.ts
/**
 * The permanent far-left Workspace App rail (spec §2/§20): DSH / Agent plus
 * every eligible managed page, in stable registry order. A row appears only
 * when the shell's closed projection reports it eligible (registry ownership +
 * enabled + runtime registration; the shell also filters hidden). Accessible
 * current-page state via aria-current, roving-tabindex keyboard navigation,
 * and stable labels/ordering. Pure component: rows, active id, and the select
 * callback arrive from the shell.
 * @module @deepseek-ai/dsh-client-ui-page-app-manager/client/PageAppRail
 */
/** One rail row projected by the shell from the controller snapshot. */
interface PageAppRailRow {
  /** Managed page id. */
  readonly pageId: string;
  /** Display label (the manifest page name). */
  readonly label: string;
  /** Registry order (ascending). */
  readonly order: number;
}
/** Injected props the shell hands to the rail. */
interface PageAppRailInjected {
  /** Ordered eligible rows (DSH/Agent is always rendered first, not a row). */
  readonly rows: readonly PageAppRailRow[];
  /** Active page id, or null when the built-in DSH page is active. */
  readonly activePageId: string | null;
  /** Select one page (null = built-in DSH). */
  readonly select: (pageId: string | null) => void;
}
/** The permanent far-left launcher (see module doc). */
declare function PageAppRail({
  rows,
  activePageId,
  select
}: PageAppRailInjected): import("react").JSX.Element;
//#endregion
//#region lib/types/client/PageAppSettingsTab.d.ts
/** The controller face the manager apply() hands to the tab registration. */
interface PageAppSettingsTabInjected {
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
type PageAppSettingsTabProps = PropsRuntime<'settings.plugins.tab'> & PropsLocale<'settings.pageApp'> & InjectFace<PageAppSettingsTabInjected>;
/** Render the Workspace Apps settings tab. */
declare function PageAppSettingsTab({
  usePageApp,
  t,
  install,
  setEnabled,
  setHidden,
  uninstall,
  recover,
  cancelInstall
}: PageAppSettingsTabProps): ReactNode;
//#endregion
export { MutableObservable, NS, PAGE_APP_DSH_PAGE, PAGE_APP_SURFACE_SLOT, PageAppActivationView, PageAppBuiltinOwner, PageAppClientSnapshot, PageAppController, PageAppControllerDeps, PageAppManagerRemoteMethods, PageAppObservable, PageAppRail, PageAppRailInjected, PageAppRailRow, PageAppRemoteEvents, PageAppRemoteResult, PageAppSettingsKey, PageAppSettingsTab, PageAppSettingsTabInjected, PageAppSettingsTabProps, PageAppShell, PageAppShellInjected, PageAppShellProps, PageAppSlotsSeam, PageAppSurfaceOwner, WORKBENCH_CLIENT_SERVICE, WorkbenchClientBridge, WorkbenchClientBridgeService, WorkbenchSurfaceRegistration, apply, en, inject, zh };