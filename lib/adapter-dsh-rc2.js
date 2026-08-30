import { a as composeProfilePatches, d as prepareManagerRuntimeLayer, f as profileRuntimeControl, m as require_js_yaml, n as ProfileRuntime, o as loadOptionalPatches, p as readManagerLayerPatches, s as loadOverlayPatches, t as PROFILE_RUNTIME_SERVICE } from "./profile-runtime-bridge-BAIkQibq.mjs";
import { WORKSPACE_HOST_ADAPTER_SERVICE, WORKSPACE_HOST_BRIDGE_VERSION } from "./host-bridge.js";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { applyEntryPatches, entryListSchema } from "@deepseek-ai/cordis-plugin-include";
import { AsyncLocalStorage } from "node:async_hooks";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

//#region src/host/legacy-rc2-compat.ts
/**
* Explicit compatibility bootstrap for npm DSH 0.1.1-rc.2.
*
* That launcher predates the launcher-owned `profileRuntime` service and still
* writes user-patch generations directly to the root Include. This module is
* removable once the minimum public DSH release provides `profileRuntime`:
* the first guard becomes a complete no-op on that native path.
*/
var import_js_yaml = require_js_yaml();
const NAME = "dsh workspace manager rc2 host adapter";
const MANAGER_PACKAGE = "@tingyu9527/dsh-workspace-manager";
const MANAGER_ENTRY_ID = "page-app-manager";
const RC2_ADAPTER_PACKAGE = `${MANAGER_PACKAGE}/adapters/dsh/rc2`;
const PROFILE_PATCH_FILENAME = "cordis.patch.yml";
/** Machine-readable RC2 Host Adapter identity exposed to the Manager service. */
const RC2_HOST_DESCRIPTOR = Object.freeze({
	hostName: "dsh",
	hostVersion: "0.1.1-rc.2",
	adapterId: "dsh-0.1.1-rc.2-layout-replacement",
	adapterVersion: "1.0.0",
	bridgeVersion: 1,
	integrationMode: "layout-replacement",
	capabilities: Object.freeze([
		"native-surface",
		"navigation",
		"panels",
		"host-events",
		"page-app-remote",
		"bundle-composition"
	])
});
const PROFILE_ROOT_FILENAME = "cordis.yml";
const FIBER_STATE = Object.freeze({
	PENDING: 0,
	LOADING: 1,
	ACTIVE: 2,
	FAILED: 3,
	DISPOSED: 4,
	UNLOADING: 5
});
/** Pinned first row of the manager bundle's Host Adapter anchor. */
const RC2_HOST_ADAPTER_ENTRY_ID = "workspace-manager-dsh-host-adapter";
function compatibleNativeRuntime(value) {
	if (value === null || typeof value !== "object") return false;
	const runtime = value;
	const identity = runtime.identity;
	return identity !== null && typeof identity === "object" && Object.isFrozen(identity) && typeof identity.name === "string" && typeof identity.directory === "string" && typeof runtime.applyManagerLayer === "function" && typeof runtime.restoreManagerLayer === "function";
}
function terminalFiberState(state) {
	return state === FIBER_STATE.FAILED || state === FIBER_STATE.DISPOSED || state === FIBER_STATE.UNLOADING;
}
function explicitlyDisablesCompat(layer) {
	return applyEntryPatches([{
		id: RC2_HOST_ADAPTER_ENTRY_ID,
		name: RC2_ADAPTER_PACKAGE
	}], structuredClone([...layer]), () => {}).find((row) => row.id === RC2_HOST_ADAPTER_ENTRY_ID)?.disabled === true;
}
function insertedRows(patch) {
	if (patch === null || typeof patch !== "object" || Array.isArray(patch)) return [];
	const insert = patch.insert;
	return Array.isArray(insert) ? insert : [];
}
function rowIdentity(row) {
	return row !== null && typeof row === "object" && !Array.isArray(row) ? row : {};
}
function hasOrderedAnchor(layer) {
	return orderedAnchorPatchIndexes(layer).length > 0;
}
function orderedAnchorPatchIndexes(layer) {
	return layer.flatMap((patch, patchIndex) => {
		const rows = insertedRows(patch);
		return rows.some((row, index) => {
			const first = rowIdentity(row);
			const second = rowIdentity(rows[index + 1]);
			return first.id === "workspace-manager-dsh-host-adapter" && first.name === RC2_ADAPTER_PACKAGE && second.id === MANAGER_ENTRY_ID && second.name === MANAGER_PACKAGE;
		}) ? [patchIndex] : [];
	});
}
function anchorCount(layer) {
	return layer.flatMap(insertedRows).filter((row) => rowIdentity(row).id === RC2_HOST_ADAPTER_ENTRY_ID).length;
}
/**
* Prove the bundle/user boundary from the actual resolved bundle layers.
* The manager bundle must be final and carry one ordered bootstrap→manager anchor.
*/
function locateLegacyRc2BundleBoundary(patches, bundleLayers) {
	const managerLayer = bundleLayers.at(-1);
	if (managerLayer === void 0 || !hasOrderedAnchor(managerLayer)) {
		if (bundleLayers.some((layer) => hasOrderedAnchor(layer))) throw new Error(`${NAME}: manager compatibility anchor must be in the final bundle layer`);
		throw new Error(`${NAME}: manager bundle lacks the ordered anchor`);
	}
	const allBundlePatches = bundleLayers.flatMap((layer) => [...layer]);
	if (anchorCount(allBundlePatches) !== 1) throw new Error(`${NAME}: compatibility anchor must occur exactly once`);
	const managerStart = allBundlePatches.length - managerLayer.length;
	const expectedAnchorIndexes = orderedAnchorPatchIndexes(managerLayer);
	const receivedAnchorIndexes = orderedAnchorPatchIndexes(patches);
	const expectedManagerAnchorIndex = expectedAnchorIndexes[0];
	if (expectedManagerAnchorIndex === void 0) throw new Error(`${NAME}: manager bundle lacks the ordered anchor`);
	const expectedAnchorIndex = managerStart + expectedManagerAnchorIndex;
	if (anchorCount(patches) !== 1 || receivedAnchorIndexes.length !== 1) throw new Error(`${NAME}: root Include compatibility anchor must occur exactly once as an ordered pair`);
	if (patches.length < allBundlePatches.length || receivedAnchorIndexes[0] !== expectedAnchorIndex) throw new Error(`${NAME}: root Include compatibility anchor is outside its exact final-bundle position`);
	return {
		bundlePatches: structuredClone(allBundlePatches),
		suffix: structuredClone(patches.slice(allBundlePatches.length))
	};
}
function parseManagerPatches(content) {
	const parsed = (0, import_js_yaml.load)(content, { schema: entryListSchema });
	if (!Array.isArray(parsed)) throw new Error(`${NAME}: manager runtime layer must be a top-level array`);
	return parsed;
}
/** One FIFO shared by manager generations and legacy watcher updates. */
var LegacyRc2UpdateCoordinator = class {
	bundlePatches;
	managerOperation = new AsyncLocalStorage();
	tail = Promise.resolve();
	managerPatches;
	disposed = false;
	constructor(bundlePatches, initialManagerPatches) {
		this.bundlePatches = bundlePatches;
		this.managerPatches = structuredClone(initialManagerPatches);
	}
	enqueue(task) {
		const run = this.tail.then(task, task);
		this.tail = run.then(() => {}, () => {});
		return run;
	}
	/** Run a complete manager apply/audit/promotion as one FIFO operation. */
	async runManager(task, promoted) {
		return await this.enqueue(async () => await this.managerOperation.run(true, async () => {
			const result = await task();
			if (promoted !== void 0) this.managerPatches = structuredClone(typeof promoted === "function" ? promoted() : promoted);
			return result;
		}));
	}
	/** Intercept one exact root-Include update. */
	async intercept(config, next, dispose) {
		if (this.disposed || this.managerOperation.getStore() === true) {
			await next();
			return;
		}
		const patches = config.patches;
		if (!Array.isArray(patches)) {
			this.disposed = true;
			dispose();
			await next();
			return;
		}
		if (anchorCount(patches) === 0) {
			this.disposed = true;
			dispose();
			await next();
			return;
		}
		const boundary = locateLegacyRc2BundleBoundary(patches, [this.bundlePatches]);
		await this.enqueue(async () => {
			if (explicitlyDisablesCompat(boundary.suffix)) {
				this.disposed = true;
				dispose();
				config.patches = structuredClone([...boundary.bundlePatches, ...boundary.suffix]);
				await next();
				return;
			}
			config.patches = structuredClone([
				...boundary.bundlePatches,
				...this.managerPatches,
				...boundary.suffix
			]);
			await next();
		});
	}
};
var LegacyRc2ProfileRuntime = class extends ProfileRuntime {
	coordinator;
	ready;
	constructor(ctx, options, coordinator, ready) {
		super(ctx, options);
		this.coordinator = coordinator;
		this.ready = ready;
	}
	async applyManagerLayer(request) {
		await this.ready();
		const patches = parseManagerPatches(request.runtimeLayer);
		return await this.coordinator.runManager(async () => await super.applyManagerLayer(request), patches);
	}
	async restoreManagerLayer(request) {
		await this.ready();
		const patches = parseManagerPatches(request.runtimeLayer);
		return await this.coordinator.runManager(async () => await super.restoreManagerLayer(request), patches);
	}
};
/**
* Tear down the exact compatibility owner after an asynchronous post-bootstrap
* failure.  The original error remains the primary diagnostic; a disposal
* failure is retained alongside it instead of leaving a half-live service.
*/
async function disposeLegacyRc2FiberAfterReadyFailure(ctx, error, activeTimeoutMs = 1e4) {
	ctx.logger.error(error);
	if (ctx.fiber.state === FIBER_STATE.PENDING || ctx.fiber.state === FIBER_STATE.LOADING) try {
		await awaitLegacyRc2FiberActive(ctx, activeTimeoutMs);
	} catch {
		if (terminalFiberState(ctx.fiber.state)) return;
	}
	try {
		await ctx.fiber.dispose();
	} catch (disposeError) {
		ctx.logger.error(new AggregateError([error, disposeError], `${NAME}: post-bootstrap failure and compatibility-fiber disposal failure`));
	}
}
/** Wait until Cordis commits the bootstrap provider, without polling or awaiting this same fiber. */
function awaitLegacyRc2FiberActive(ctx, timeoutMs = 1e4) {
	const stateError = () => {
		if (ctx.fiber.state === FIBER_STATE.ACTIVE) return;
		if (ctx.fiber.state === FIBER_STATE.FAILED || ctx.fiber.state === FIBER_STATE.DISPOSED || ctx.fiber.state === FIBER_STATE.UNLOADING) return /* @__PURE__ */ new Error(`${NAME}: compatibility fiber exited before becoming active`);
	};
	const initialError = stateError();
	if (ctx.fiber.state === FIBER_STATE.ACTIVE) return Promise.resolve();
	if (initialError !== void 0) return Promise.reject(initialError);
	return new Promise((resolveBarrier, rejectBarrier) => {
		let settled = false;
		let watchdog;
		let stopListening = () => {};
		const finish = (error) => {
			if (settled) return;
			settled = true;
			stopListening();
			if (watchdog !== void 0) clearTimeout(watchdog);
			if (error === void 0) resolveBarrier();
			else rejectBarrier(error);
		};
		const inspect = () => {
			if (ctx.fiber.state === FIBER_STATE.ACTIVE) finish();
			else {
				const error = stateError();
				if (error !== void 0) finish(error);
			}
		};
		stopListening = ctx.on("internal/status", (fiber) => {
			if (fiber === ctx.fiber) inspect();
		});
		inspect();
		if (ctx.fiber.state !== FIBER_STATE.ACTIVE && !terminalFiberState(ctx.fiber.state)) watchdog = setTimeout(() => {
			finish(/* @__PURE__ */ new Error(`${NAME}: compatibility fiber did not become active within ${timeoutMs}ms`));
		}, timeoutMs);
	});
}
/** Prepare the derived layer before capturing the exact restart snapshot. */
async function prepareLegacyRc2ManagerSnapshot(binName, profileDirectory) {
	return {
		startup: await prepareManagerRuntimeLayer(binName, profileDirectory, MANAGER_PACKAGE),
		managerPatches: readManagerLayerPatches(binName, profileDirectory)
	};
}
function resolvePackageManifest(requireFromProfile, packageName) {
	try {
		return requireFromProfile.resolve(`${packageName}/package.json`);
	} catch {
		let current = dirname(requireFromProfile.resolve(packageName));
		const root = parse(current).root;
		while (current !== root) {
			const candidate = join(current, "package.json");
			try {
				if (JSON.parse(readFileSync(candidate, "utf8")).name === packageName) return candidate;
			} catch {}
			current = dirname(current);
		}
		throw new Error(`${NAME}: cannot resolve package root for ${packageName}`);
	}
}
function readBundleLayers(profileDirectory) {
	const bundles = JSON.parse(readFileSync(join(profileDirectory, "package.json"), "utf8")).dsh?.profile?.bundles;
	if (!Array.isArray(bundles) || !bundles.every((name) => typeof name === "string")) throw new Error(`${NAME}: profile manifest has no ordered bundle list`);
	if (bundles.at(-1) !== MANAGER_PACKAGE) throw new Error(`${NAME}: manager bundle must be the final profile bundle`);
	const requireFromProfile = createRequire(join(profileDirectory, "package.json"));
	return bundles.map((packageName) => {
		const packageManifest = resolvePackageManifest(requireFromProfile, packageName);
		const patch = JSON.parse(readFileSync(packageManifest, "utf8")).dsh?.bundle?.patch;
		if (typeof patch !== "string") throw new Error(`${NAME}: ${packageName} has no bundle patch`);
		return loadOverlayPatches(NAME, resolve(dirname(packageManifest), patch));
	});
}
/** Validate the public launcher root against its authoritative DSH home helper. */
function resolveLegacyRc2ProfileIdentity(dshHomePath, rootConfig) {
	const homeDirectory = resolve(dshHomePath());
	const config = resolve(rootConfig);
	const profileDirectory = dirname(config);
	const name = profileDirectory.split(/[\\/]/u).at(-1) ?? "";
	const expected = resolve(dshHomePath("profiles", name, PROFILE_ROOT_FILENAME));
	if (name.length === 0 || config !== expected) throw new Error(`${NAME}: root Include must target DSH_HOME/profiles/<name>/${PROFILE_ROOT_FILENAME}`);
	return Object.freeze({
		name,
		directory: profileDirectory,
		homeDirectory
	});
}
function strictRootInclude(ctx) {
	const loader = ctx.root.get("loader");
	if (loader === void 0) throw new Error(`${NAME}: root Loader is unavailable`);
	const entry = loader.resolve("include");
	const config = entry.options.config;
	if (entry.options.id !== "include" || entry.options.name !== "cordis:include" || entry.fiber === void 0 || typeof config?.path !== "string" || !Array.isArray(config.patches)) throw new Error(`${NAME}: root Include fingerprint failed`);
	const rootConfig = fileURLToPath(new URL(config.path, entry.ctx.baseUrl));
	const dshHomePath = ctx.root.get("dshHomePath");
	if (typeof dshHomePath !== "function") throw new Error(`${NAME}: root dshHomePath service is unavailable`);
	return {
		entry,
		profile: resolveLegacyRc2ProfileIdentity(dshHomePath, rootConfig),
		patches: config.patches
	};
}
/** Cordis plugin bootstrap. The native launcher path returns before any structural change. */
function apply(ctx) {
	const nativeRuntime = ctx.root.get(PROFILE_RUNTIME_SERVICE);
	if (nativeRuntime !== void 0) {
		if (!compatibleNativeRuntime(nativeRuntime)) throw new Error(`${NAME}: native profileRuntime service has an incompatible structure`);
		return;
	}
	const { entry, profile, patches } = strictRootInclude(ctx);
	const profileDirectory = profile.directory;
	const requireFromProfile = createRequire(join(profileDirectory, "package.json"));
	if (JSON.parse(readFileSync(resolvePackageManifest(requireFromProfile, "@deepseek-ai/dsh-app-boot"), "utf8")).version !== "0.1.1-rc.2") throw new Error(`${NAME}: legacy bootstrap supports only public @deepseek-ai/dsh-app-boot 0.1.1-rc.2`);
	ctx.provide(WORKSPACE_HOST_ADAPTER_SERVICE, RC2_HOST_DESCRIPTOR);
	const boundary = locateLegacyRc2BundleBoundary(patches, readBundleLayers(profileDirectory));
	const profilePatches = loadOptionalPatches(NAME, join(profileDirectory, PROFILE_PATCH_FILENAME)) ?? [];
	const homeDirectory = profile.homeDirectory;
	const homePatches = loadOptionalPatches(NAME, join(homeDirectory, PROFILE_PATCH_FILENAME)) ?? [];
	const userPrefix = [...profilePatches, ...homePatches];
	if (!isDeepStrictEqual(boundary.suffix.slice(0, userPrefix.length), userPrefix)) throw new Error(`${NAME}: root Include user-layer boundary does not match profile and home patches`);
	const overlays = structuredClone(boundary.suffix.slice(userPrefix.length));
	const coordinator = new LegacyRc2UpdateCoordinator(boundary.bundlePatches, []);
	const rootFiber = entry.fiber;
	const rootPath = entry.options.config.path;
	let dispose = () => {};
	dispose = ctx.on("internal/update", async function(config, _noSave, next) {
		const candidate = config;
		if (this !== rootFiber || candidate.path !== rootPath) {
			await next();
			return;
		}
		await coordinator.intercept(candidate, next, dispose);
	}, {
		global: true,
		prepend: true
	});
	let preparedManagerPatches = [];
	let postReady = Promise.resolve();
	const control = profileRuntimeControl(new LegacyRc2ProfileRuntime(ctx, {
		identity: {
			name: profile.name,
			directory: profileDirectory
		},
		ownerPackageName: MANAGER_PACKAGE,
		compose: (managerPatches) => composeProfilePatches({
			bundlePatches: boundary.bundlePatches,
			managerPatches,
			profilePatches: loadOptionalPatches(NAME, join(profileDirectory, PROFILE_PATCH_FILENAME)) ?? [],
			homePatches: loadOptionalPatches(NAME, join(homeDirectory, PROFILE_PATCH_FILENAME)) ?? [],
			overlays
		}),
		initialManagerPatches: []
	}, coordinator, async () => {
		await postReady;
	}));
	if (control === void 0) throw new Error(`${NAME}: constructed runtime has no boot control`);
	control.bindRootInclude(entry);
	postReady = coordinator.runManager(async () => {
		const snapshot = await prepareLegacyRc2ManagerSnapshot(NAME, profileDirectory);
		preparedManagerPatches = snapshot.managerPatches;
		control.initializeManagerSnapshot({
			managerPatches: preparedManagerPatches,
			...snapshot.startup.recoveryError === void 0 ? {} : { recoveryError: snapshot.startup.recoveryError },
			omittedRoots: snapshot.startup.omitted
		});
		await awaitLegacyRc2FiberActive(ctx);
		await ctx.get("loader")?.await();
		await control.markSettled();
		await control.recompose();
	}, () => preparedManagerPatches);
	postReady.catch(async (error) => {
		await disposeLegacyRc2FiberAfterReadyFailure(ctx, error);
	});
}

//#endregion
export { RC2_HOST_ADAPTER_ENTRY_ID, RC2_HOST_DESCRIPTOR, apply };