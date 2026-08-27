import { a as prepareManagerRuntimeLayer, i as ProfileRuntimeApplyResult, n as ProfileRuntime, r as ProfileRuntimeApplyRequest } from "./profile-runtime-bridge-OpnsCJny.js";
import { Context } from "@deepseek-ai/cordis";
import { PatchOptions } from "@deepseek-ai/cordis-plugin-include";

//#region lib/types/legacy-rc2-compat.d.ts
/** Pinned first row of the manager bundle's legacy bootstrap anchor. */
declare const LEGACY_RC2_COMPAT_ENTRY_ID = "page-app-manager-legacy-rc2-compat";
interface BundleBoundary {
  readonly bundlePatches: PatchOptions[];
  readonly suffix: PatchOptions[];
}
/**
 * Prove the bundle/user boundary from the actual resolved bundle layers.
 * The manager bundle must be final and carry one ordered bootstrap→manager anchor.
 */
declare function locateLegacyRc2BundleBoundary(patches: readonly PatchOptions[], bundleLayers: readonly (readonly PatchOptions[])[]): BundleBoundary;
/** One FIFO shared by manager generations and legacy watcher updates. */
declare class LegacyRc2UpdateCoordinator {
  private readonly bundlePatches;
  private readonly managerOperation;
  private tail;
  private managerPatches;
  private disposed;
  constructor(bundlePatches: readonly PatchOptions[], initialManagerPatches: readonly PatchOptions[]);
  private enqueue;
  /** Run a complete manager apply/audit/promotion as one FIFO operation. */
  runManager<T>(task: () => Promise<T>, promoted?: readonly PatchOptions[] | (() => readonly PatchOptions[])): Promise<T>;
  /** Intercept one exact root-Include update. */
  intercept(config: Record<string, unknown>, next: () => void | Promise<void>, dispose: () => void): Promise<void>;
}
declare class LegacyRc2ProfileRuntime extends ProfileRuntime {
  private readonly coordinator;
  private readonly ready;
  constructor(ctx: Context, options: ConstructorParameters<typeof ProfileRuntime>[1], coordinator: LegacyRc2UpdateCoordinator, ready: () => Promise<void>);
  applyManagerLayer(request: ProfileRuntimeApplyRequest): Promise<ProfileRuntimeApplyResult>;
  restoreManagerLayer(request: ProfileRuntimeApplyRequest): Promise<ProfileRuntimeApplyResult>;
}
/**
 * Tear down the exact compatibility owner after an asynchronous post-bootstrap
 * failure.  The original error remains the primary diagnostic; a disposal
 * failure is retained alongside it instead of leaving a half-live service.
 */
declare function disposeLegacyRc2FiberAfterReadyFailure(ctx: Context, error: unknown, activeTimeoutMs?: number): Promise<void>;
/** Wait until Cordis commits the bootstrap provider, without polling or awaiting this same fiber. */
declare function awaitLegacyRc2FiberActive(ctx: Context, timeoutMs?: number): Promise<void>;
/** Prepare the derived layer before capturing the exact restart snapshot. */
declare function prepareLegacyRc2ManagerSnapshot(binName: string, profileDirectory: string): Promise<{
  startup: Awaited<ReturnType<typeof prepareManagerRuntimeLayer>>;
  managerPatches: PatchOptions[];
}>;
interface LegacyRc2ProfileIdentity {
  readonly name: string;
  readonly directory: string;
  readonly homeDirectory: string;
}
/** Validate the public launcher root against its authoritative DSH home helper. */
declare function resolveLegacyRc2ProfileIdentity(dshHomePath: (...segments: string[]) => string, rootConfig: string): LegacyRc2ProfileIdentity;
/** Cordis plugin bootstrap. The native launcher path returns before any structural change. */
declare function apply(ctx: Context): void;
//#endregion
export { LEGACY_RC2_COMPAT_ENTRY_ID, LegacyRc2ProfileRuntime, LegacyRc2UpdateCoordinator, apply, awaitLegacyRc2FiberActive, disposeLegacyRc2FiberAfterReadyFailure, locateLegacyRc2BundleBoundary, prepareLegacyRc2ManagerSnapshot, resolveLegacyRc2ProfileIdentity };