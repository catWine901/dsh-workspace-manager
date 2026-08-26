import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { z } from "zod";
import { PROFILE_RUNTIME_SERVICE, WORKBENCH_RUNTIME_SERVICE as WORKBENCH_RUNTIME_SERVICE$1, canonicalManagedRootHash, loadOverlayPatches, managedRootWrapperId, managedRootWrapperRow, managerWrapperResolvable } from "@deepseek-ai/dsh-app-boot";
import { applyEntryPatches, entryListSchema } from "@deepseek-ai/cordis-plugin-include";
import { load } from "js-yaml";
import { advancePageAppJournalPhase, assertPageAppSourceNoCredentials, parsePageAppJournal, parsePageAppManifest, parsePageAppRegistry, parsePageAppSourceDisplay, readPageAppJournal, readPageAppRegistry, removePageAppJournal, renderPageAppRuntimeLayer, resolvePageAppProfilePaths, snapshotPageAppJournalFiles, withPageAppProfileLock, writePageAppJournal, writePageAppRegistry } from "@deepseek-ai/dsh-page-app-profile";
import { readFile, rm, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
//#region lib/types/adapter.js
/**
* Cordis Compatibility Adapter — the sole runtime-import location for
* `@deepseek-ai/cordis`, `@deepseek-ai/cordis-plugin-loader`, and
* `@deepseek-ai/cordis-plugin-include` inside Manager product code. Every
* Workbench concern that reads Cordis state (managed-root hashing, include
* patch composition and parsing, Loader row lookup, fiber projection) is
* delegated here, so a Cordis API change lands in one file. The adapter spec
* pins each delegation against the vendored Cordis surface it wraps, and the
* import gate keeps the rest of `src/` Cordis-free at runtime — only a
* type-only `Context` import may leave the adapter.
* @module @deepseek-ai/dsh-page-app-manager/adapter
*/
/**
* Stable hash of one managed root row. Workbench concern: expected-root hashes
* (registry audit, row health `hashMatches`); Cordis mechanism:
* `canonicalManagedRootHash` — the canonical YAML rendering the runtime audits
* against, so a derived row and the Loader's effective options of the same
* content hash identically.
* @param row - the entry row to hash.
* @returns the hex SHA-256 digest of the canonical rendering.
*/
function managedRootHash(row) {
	return canonicalManagedRootHash(row);
}
/**
* Compose one patch list over an empty root. Workbench concern: the bundle
* patch composition the manager validates and health-checks; Cordis mechanism:
* Include's `applyEntryPatches` — the exact patch semantics a mounted include
* layer applies, so a dump can never drift from what boots. The input list is
* cloned first and never mutated: a later patch may reconfigure an
* earlier-inserted row, which would otherwise bake values into the caller's
* parsed data.
* @param patches - the patch list to apply, in order (undefined composes an empty root).
* @param warn - sink for skipped-patch diagnostics (a skipped target rejects validation).
* @returns a detached entry list with every applicable patch applied.
*/
function composePatchRows(patches, warn) {
	return applyEntryPatches([], structuredClone(patches), warn ?? (() => {}));
}
/**
* Parse one loader-patch document in the include's entry-list dialect.
* Workbench concern: the bundle `cordis.patch.yml` parse; Cordis mechanism:
* Include's `entryListSchema` — the same `!!js` YAML dialect the include
* mounts, so the manager's parse can never drift from what boots.
* @param content - the patch document text.
* @returns the parsed document (a top-level array is the patch list).
*/
function parseEntryList(content) {
	return load(content, { schema: entryListSchema });
}
/**
* Find one Loader row by its root entry id. Workbench concern: the runtime
* facts behind a row's health (`activation-failed` / `externally-overridden`);
* Cordis mechanism: `Loader.entries()` — the flattened tree iteration, so rows
* in nested subtrees are found exactly as the projection reads them.
* @param loader - the Loader service (or any surface exposing `entries()`).
* @param rootEntryId - the managed root entry id to find.
* @returns the loader row, or undefined when no entry carries the id.
*/
function findLoaderRow(loader, rootEntryId) {
	for (const entry of loader.entries()) if (entry.options.id === rootEntryId) return entry;
}
/**
* Project the numeric fiber state of one loader row. Workbench concern: the
* `runtimeState` health surface; Cordis mechanism: `Entry.fiber.state` — the
* FiberState value (`PENDING`/`LOADING`/`ACTIVE`/`FAILED`/`DISPOSED`/
* `UNLOADING`), undefined when the row has no fiber yet.
* @param loaderRow - the loader row to project.
* @returns the numeric FiberState, or undefined.
*/
function fiberStateOf(loaderRow) {
	return loaderRow?.fiber?.state;
}
/** The `FiberState` member values; Cordis's const enum has no runtime object (mirrored like app-boot). */
const FIBER_STATE_PENDING = 0;
const FIBER_STATE_LOADING = 1;
const FIBER_STATE_ACTIVE = 2;
const FIBER_STATE_FAILED = 3;
const FIBER_STATE_DISPOSED = 4;
const FIBER_STATE_UNLOADING = 5;
/**
* Whether one projected fiber state is ACTIVE. Workbench concern: the `ready`
* health requires the mounted wrapper row to be active, not merely present;
* Cordis mechanism: `FiberState.ACTIVE` — the const enum has no runtime
* object, so the numeric value is mirrored here exactly as app-boot mirrors it.
* @param state - the projected numeric fiber state.
* @returns true only for the ACTIVE state.
*/
function isActiveFiberState(state) {
	return state === FIBER_STATE_ACTIVE;
}
/**
* Project one projected fiber state to its semantic label. Workbench concern:
* the `runtimeState` health surface; Cordis mechanism: the `FiberState` enum —
* a const enum with no runtime object, so the member values are mirrored here
* member-by-member, never reverse-looked-up; `DISPOSED` (a terminal state)
* collapses into `failed` until the next generation remounts the root.
* @param state - the projected numeric fiber state.
* @returns the semantic label, or undefined for an unknown or absent state.
*/
function fiberStateLabelOf(state) {
	switch (state) {
		case FIBER_STATE_PENDING: return "pending";
		case FIBER_STATE_LOADING: return "loading";
		case FIBER_STATE_ACTIVE: return "active";
		case FIBER_STATE_FAILED: return "failed";
		case FIBER_STATE_DISPOSED: return "failed";
		case FIBER_STATE_UNLOADING: return "unloading";
		default: return;
	}
}
//#endregion
//#region lib/types/source.js
/**
* Install-source parsing: classify one specifier the Settings add-flow accepts
* into a validated pnpm source plus a redacted persisted display. Registry and
* Git specs may be typed; local directory, `file:`, `link:`, and tarball
* sources must come from the picker as absolute paths. Ambiguous relative
* filesystem specs are rejected rather than resolved against Host cwd (spec
* §10.1), and credential-bearing URLs are rejected (spec §7 / SR-07).
* @module @deepseek-ai/dsh-page-app-manager/source
*/
/** Tarball file-name suffixes pnpm can install from a local archive. */
const TARBALL_PATTERN = /\.(?:tgz|tar\.gz)$/i;
/** Scoped or plain bare package-name grammar (no version, path, or drive part). */
const BARE_PACKAGE_PATTERN = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
/** Git specifier forms accepted in v1 (pnpm git source semantics). */
const GIT_PATTERN = /^(?:github:|git\+|git@|https?:\/\/.*\.git(?:[#?]|$))/;
/** Scheme-prefixed registry specifier (`npm:pkg` is pnpm's explicit form). */
const NPM_SPEC_PATTERN = /^npm:/;
/**
* Classify an untyped install spec into a source kind. Picker-backed local
* sources arrive as absolute paths; typed registry/Git specs carry their own
* grammar; anything that looks like a relative filesystem spec is rejected.
* @param spec - the raw install spec.
* @returns the classified kind.
* @throws {Error} for an empty spec or an ambiguous relative filesystem spec.
*/
function classify(spec) {
	if (/^file:/i.test(spec)) return "file";
	if (/^link:/i.test(spec)) return "link";
	if (NPM_SPEC_PATTERN.test(spec)) return "registry";
	if (GIT_PATTERN.test(spec)) return "git";
	if (isAbsolute(spec)) return TARBALL_PATTERN.test(spec) ? "tarball" : "file";
	if (BARE_PACKAGE_PATTERN.test(spec)) return "registry";
	throw new Error(`page-app install source: "${spec}" is an ambiguous relative filesystem spec — local directory, file:, link:, and tarball sources must come from the picker as absolute paths`);
}
/**
* Validate one spec against its kind. Registry specs must stay bare package
* names (with an optional npm: prefix); Git specs must match the accepted git
* grammar; local kinds (file/link/tarball) must be absolute after any
* `file:`/`link:` prefix is stripped.
* @param kind - the classified or caller-typed kind.
* @param spec - the spec to validate.
* @throws {Error} when the spec does not satisfy the kind's grammar.
*/
function validateKindSpec(kind, spec) {
	switch (kind) {
		case "registry": {
			const bare = NPM_SPEC_PATTERN.test(spec) ? spec.slice(4) : spec;
			if (!BARE_PACKAGE_PATTERN.test(bare)) throw new Error(`page-app install source: "${spec}" is not a bare package name (registry specs cannot carry paths or aliases)`);
			return;
		}
		case "git":
			if (!GIT_PATTERN.test(spec)) throw new Error(`page-app install source: "${spec}" is not a supported git specifier (github:, git+https:, git@, or a .git URL)`);
			return;
		case "file":
		case "link":
		case "tarball": {
			const pathPart = spec.replace(/^(?:file|link):/i, "");
			if (!isAbsolute(pathPart)) throw new Error(`page-app install source: "${spec}" must be an absolute path (picker-backed local source)`);
			if (kind === "tarball" && !TARBALL_PATTERN.test(pathPart)) throw new Error(`page-app install source: "${spec}" is not a tarball path (.tgz or .tar.gz)`);
			return;
		}
	}
}
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
function parsePageAppInstallSource(spec, kind) {
	assertPageAppSourceNoCredentials(spec);
	const trimmed = spec.trim();
	if (trimmed === "") throw new Error("page-app install source: spec is empty");
	const resolvedKind = kind ?? classify(trimmed);
	validateKindSpec(resolvedKind, trimmed);
	return Object.freeze({
		kind: resolvedKind,
		spec: trimmed,
		display: parsePageAppSourceDisplay(resolvedKind, trimmed)
	});
}
//#endregion
//#region lib/types/activation.js
/**
* Targeted client activation acknowledgement: install publishes the registry
* only after the FIRST valid acknowledgement from the opaque initiating client
* instance. Every connected browser may reconcile the graph, but only the
* targeted controller may acknowledge the transaction; stale transactions,
* wrong instances, wrong package/page/revision, and second acknowledgements
* are rejected (spec §10.1).
* @module @deepseek-ai/dsh-page-app-manager/activation
*/
/**
* One-shot activation gate. The manager opens it with the pending request
* before applying the runtime layer; the first acknowledgement that matches
* every field settles it. The gate is single-shot per transaction: it is
* discarded after the transaction ends (success, rollback, or abort).
*/
var PageAppActivationGate = class {
	request;
	settled = false;
	waiters = [];
	/** Whether an activation is currently pending. */
	get pending() {
		return this.request !== void 0 && !this.settled;
	}
	/** The pending request, when one exists (even after settlement). */
	get pendingRequest() {
		return this.request;
	}
	/**
	* Announce the pending activation. A second open without settlement throws —
	* one gate, one transaction.
	* @param request - the targeted activation request.
	* @throws {Error} when a request is already open.
	*/
	open(request) {
		if (this.request !== void 0) throw new Error("page-app activation: gate already has a pending request");
		this.request = request;
	}
	/**
	* Wait for the first valid acknowledgement, bounded by a Host timeout.
	* Rejects when the gate is discarded before any acknowledgement arrives,
	* when the signal aborts, or when the timeout elapses first — a vanished
	* client can never hold the profile lock indefinitely in a live process.
	* @param signal - cancellation; an aborted wait rejects.
	* @param timeoutMs - Host cap on the settlement wait; elapsing rejects.
	* @returns the settled request.
	*/
	awaitSettlement(signal, timeoutMs) {
		return new Promise((resolve, reject) => {
			if (this.request === void 0) {
				reject(/* @__PURE__ */ new Error("page-app activation: no pending activation to await"));
				return;
			}
			if (this.settled) {
				resolve(this.request);
				return;
			}
			if (signal.aborted) {
				reject(/* @__PURE__ */ new Error("page-app activation: settlement wait aborted"));
				return;
			}
			const onTimeout = () => {
				signal.removeEventListener("abort", onAbort);
				reject(/* @__PURE__ */ new Error("page-app activation: settlement wait timed out"));
			};
			const timer = setTimeout(onTimeout, timeoutMs);
			const onAbort = () => {
				clearTimeout(timer);
				reject(/* @__PURE__ */ new Error("page-app activation: settlement wait aborted"));
			};
			signal.addEventListener("abort", onAbort, { once: true });
			this.waiters.push({
				resolve,
				reject,
				signal,
				onAbort,
				timer
			});
		});
	}
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
	acknowledge(transactionId, clientInstanceId, packageName, pageId, graphRevision) {
		const request = this.request;
		if (request === void 0 || this.settled) return {
			accepted: false,
			reason: "stale"
		};
		if (clientInstanceId !== request.clientInstanceId) return {
			accepted: false,
			reason: "wrong-client"
		};
		if (transactionId !== request.transactionId || packageName !== request.packageName || pageId !== request.pageId || graphRevision !== request.graphRevision) return {
			accepted: false,
			reason: "wrong-target"
		};
		this.settled = true;
		const waiters = this.waiters.splice(0);
		for (const waiter of waiters) {
			waiter.signal.removeEventListener("abort", waiter.onAbort);
			if (waiter.timer !== void 0) clearTimeout(waiter.timer);
			waiter.resolve(request);
		}
		return { accepted: true };
	}
	/** Discard the gate (rollback/abort path): pending waiters reject. */
	discard() {
		this.request = void 0;
		this.settled = false;
		const waiters = this.waiters.splice(0);
		for (const waiter of waiters) {
			waiter.signal.removeEventListener("abort", waiter.onAbort);
			if (waiter.timer !== void 0) clearTimeout(waiter.timer);
			waiter.reject(/* @__PURE__ */ new Error("page-app activation: gate discarded before settlement"));
		}
	}
};
//#endregion
//#region lib/types/contract.js
/**
* Workbench Contract v1 version surface (design D2 / G-8): the Manager
* constant and the hard admission check Features must satisfy. The constant is
* the single source of truth for which `dsh.workspace.schemaVersion` values
* the manager accepts; an unsupported version is a hard preflight error, never
* a silent skip.
* @module @deepseek-ai/dsh-page-app-manager/contract
*/
/** Contract versions this Manager admits (v1 only, locked by R-3). */
const SUPPORTED_CONTRACT_VERSIONS = Object.freeze([1]);
/**
* Assert one declared contract version is admitted.
* @param version - the declared `dsh.workspace.schemaVersion` to admit.
* @param supported - the admitted version list (pass `SUPPORTED_CONTRACT_VERSIONS`).
* @throws {Error} naming the unsupported version.
*/
function assertSupportedContractVersion(version, supported) {
	if (!supported.includes(version)) throw new Error(`unsupported contract version ${version}`);
}
//#endregion
//#region lib/types/validation.js
/**
* Static Workspace Plugin Contract validation (spec §11). One installed
* package is validated against the manager registry and the effective profile
* facts BEFORE ownership state changes: the manager can safely stage a
* dependency and prove it satisfies the v1 contract without mutating anything.
* @module @deepseek-ai/dsh-page-app-manager/validation
*/
/**
* Probe the installed location of one package from the profile's own
* node_modules walk — the same anchor the profile runtime uses. Manager
* packages are profile-local pnpm installs, so the profile anchor finds them
* before any parent fallback.
* @param profileDir - absolute profile directory.
* @param packageName - the package name to locate.
* @returns the installed package directory, or undefined when not installed.
*/
function resolveInstalledPackageDir(profileDir, packageName) {
	for (const searchPath of createRequire(join(profileDir, "package.json")).resolve.paths(packageName) ?? []) {
		const candidate = join(searchPath, packageName);
		if (existsSync(join(candidate, "package.json"))) return candidate;
	}
}
/** Whether one path stays inside `root` (symlink-free containment check). */
function isInside(root, candidate) {
	const rel = relative(root, candidate);
	return rel !== "" && !rel.startsWith(".." + sep) && rel !== ".." && !isAbsolutePath(rel);
}
function isAbsolutePath(value) {
	return value.startsWith(sep) || /^[a-zA-Z]:[\\/]/.test(value);
}
/** Direct Cordis dependencies a Strict Mode Feature must never declare (G-8). */
const FORBIDDEN_DIRECT_DEPENDENCIES = ["cordis", "@deepseek-ai/cordis"];
/** Every package.json dependency section the boundary checks (matches the source-boundary gate). */
const DEPENDENCY_SECTIONS = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies"
];
/**
* Reject a package whose installed package.json declares a direct Cordis
* dependency in ANY dependency section — `dependencies`, `devDependencies`,
* `peerDependencies`, or `optionalDependencies` — matching the source-boundary
* gate and the fixture's Cordis-free semantics. The installed manifest only
* exists after pnpm staging, so the boundary runs there — before any registry
* or ownership mutation — and needs no rollback (design D2).
* @param packageName - the package being validated (diagnostic only).
* @param pkg - the parsed installed package.json.
* @throws {Error} naming the forbidden dependency and its section when declared.
*/
function rejectForbiddenDependencies(packageName, pkg) {
	for (const section of DEPENDENCY_SECTIONS) {
		const dependencies = pkg[section];
		if (dependencies === void 0) continue;
		if (typeof dependencies !== "object" || dependencies === null || Array.isArray(dependencies)) throw new Error(`page-app validation: "${packageName}" package.json ${section} must be a record`);
		for (const forbidden of FORBIDDEN_DIRECT_DEPENDENCIES) if (Object.hasOwn(dependencies, forbidden)) throw new Error(`page-app validation: "${packageName}" declares a direct ${forbidden} dependency (${section}) (Strict Mode features must not depend on Cordis; the Adapter absorbs Cordis changes)`);
	}
}
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
function validateInstalledPageAppPackage(profileDir, packageName, context) {
	const packageDir = resolveInstalledPackageDir(profileDir, packageName);
	if (packageDir === void 0) throw new Error(`page-app validation: "${packageName}" is not installed in the profile`);
	let pkg;
	try {
		pkg = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
	} catch (error) {
		throw new Error(`page-app validation: "${packageName}" package.json is unreadable: ${String(error)}`);
	}
	if (typeof pkg.name !== "string" || pkg.name === "") throw new Error(`page-app validation: "${packageName}" package.json carries no valid name`);
	if (pkg.name !== packageName) throw new Error(`page-app validation: package name "${pkg.name}" does not equal the direct dependency key "${packageName}" (pnpm alias installs are rejected in v1)`);
	if (typeof pkg.version !== "string" || pkg.version === "") throw new Error(`page-app validation: "${packageName}" package.json carries no valid version`);
	if (context.profileDependencies[packageName] === void 0) throw new Error(`page-app validation: "${packageName}" is not a direct dependency of the profile — remove it through its original installation method, then install it again through Workspace Apps (no auto-adoption in v1)`);
	if (context.profileBundles.includes(packageName)) throw new Error(`page-app validation: "${packageName}" is already installed as an external profile bundle — remove it through its original installation method first`);
	const bundle = pkg.dsh?.bundle;
	if (typeof bundle?.patch !== "string" || bundle.patch === "") throw new Error(`page-app validation: "${packageName}" declares no dsh.bundle.patch`);
	const patchPath = resolve(packageDir, bundle.patch);
	if (!isInside(packageDir, patchPath)) throw new Error(`page-app validation: "${packageName}" dsh.bundle.patch resolves outside the installed package`);
	if (!existsSync(patchPath)) throw new Error(`page-app validation: "${packageName}" dsh.bundle.patch does not exist at ${patchPath}`);
	const schemaVersion = pkg.dsh?.workspace?.schemaVersion;
	if (typeof schemaVersion === "number") assertSupportedContractVersion(schemaVersion, SUPPORTED_CONTRACT_VERSIONS);
	const manifest = parsePageAppManifest(packageName, pkg);
	rejectForbiddenDependencies(packageName, pkg);
	for (const row of context.registry?.entries ?? []) {
		if (row.packageName === packageName) throw new Error(`page-app validation: "${packageName}" is already managed in this profile`);
		if (row.page.id === manifest.id) throw new Error(`page-app validation: workspace page id "${manifest.id}" is already managed in this profile`);
		if (row.page.rootEntryId === manifest.rootEntryId) throw new Error(`page-app validation: managed root id "${manifest.rootEntryId}" is already managed in this profile`);
	}
	if (context.baseRootIds.includes(manifest.rootEntryId)) throw new Error(`page-app validation: managed root id "${manifest.rootEntryId}" collides with the base composition below the manager layer`);
	let raw;
	try {
		raw = parseEntryList(readFileSync(patchPath, "utf8"));
	} catch (error) {
		throw new Error(`page-app validation: "${packageName}" bundle patch failed to parse: ${String(error)}`);
	}
	if (!Array.isArray(raw)) throw new Error(`page-app validation: "${packageName}" bundle patch must be a top-level YAML array of loader entries`);
	const warnings = [];
	let composed;
	try {
		composed = composePatchRows(raw, (message) => {
			warnings.push(message);
		});
	} catch (error) {
		throw new Error(`page-app validation: "${packageName}" bundle patch failed to compose: ${String(error)}`);
	}
	if (warnings.length > 0) throw new Error(`page-app validation: "${packageName}" bundle patch targets rows the empty root lacks: ${warnings.join("; ")}`);
	const rootRows = composed.filter((row) => row.id === manifest.rootEntryId);
	if (rootRows.length !== 1) throw new Error(`page-app validation: "${packageName}" bundle composes ${String(rootRows.length)} top-level root(s) with id "${manifest.rootEntryId}" (exactly one required)`);
	const rootRow = rootRows[0];
	if (rootRow === void 0) throw new Error(`page-app validation: "${packageName}" root row is unavailable`);
	if (typeof rootRow.name === "string" && (rootRow.name.startsWith(".") || rootRow.name.startsWith("/"))) throw new Error(`page-app validation: "${packageName}" managed root uses a relative Loader module name "${rootRow.name}"`);
	try {
		renderPageAppRuntimeLayer([{
			packageName,
			pageId: manifest.id,
			rootEntryId: manifest.rootEntryId,
			enabled: true,
			entries: [rootRow]
		}]);
	} catch (error) {
		throw new Error(`page-app validation: "${packageName}" managed root is not declarative/serializable: ${String(error)}`);
	}
	const client = pkg.dsh?.client;
	if (typeof client !== "object" || client === null || client.platform !== "web") throw new Error(`page-app validation: "${packageName}" must declare dsh.client with platform "web"`);
	const clientExport = clientExportOf(packageName, pkg.exports);
	if (clientExport === void 0) throw new Error(`page-app validation: "${packageName}" exports no "./client" bundle`);
	if (!existsSync(join(packageDir, clientExport))) throw new Error(`page-app validation: "${packageName}" ./client artifact is missing at ${clientExport}`);
	const external = client.external;
	const externals = external === void 0 ? [] : external;
	if (!Array.isArray(externals) || externals.some((spec) => typeof spec !== "string")) throw new Error(`page-app validation: "${packageName}" dsh.client.external must be a string array`);
	if (externals.includes(packageName)) throw new Error(`page-app validation: "${packageName}" requests itself in dsh.client.external`);
	const clientRows = composed.filter((row) => row.name === packageName);
	if (clientRows.length !== 1) throw new Error(`page-app validation: "${packageName}" bundle composes ${String(clientRows.length)} client row(s) for itself (exactly one required)`);
	return Object.freeze({
		packageName,
		version: pkg.version,
		manifest,
		rootEntryId: manifest.rootEntryId,
		rootRow: Object.freeze({ ...rootRow }),
		clientRowCount: clientRows.length
	});
}
/**
* Resolve `exports["./client"]` to a relative path, accepting the string and
* one-level conditional forms (the same rule the client-modules node half uses).
* @param packageName - the package being validated (diagnostic only).
* @param exportsField - the parsed package.json exports field.
* @returns the client artifact path, or undefined when absent.
*/
function clientExportOf(packageName, exportsField) {
	if (typeof exportsField !== "object" || exportsField === null) return void 0;
	const client = exportsField["./client"];
	if (client === void 0) return void 0;
	if (typeof client === "string") return client;
	if (typeof client === "object" && client !== null) {
		const fallback = client.default;
		if (typeof fallback === "string") return fallback;
	}
	throw new Error(`page-app validation: "${packageName}" exports["./client"] must be a string or an object with a string default`);
}
//#endregion
//#region lib/types/transaction.js
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
/** Error whose message names pnpm's exact allowBuilds/build-script diagnostic. */
var PageAppBuildPermissionError = class extends Error {};
/** Every pnpm invocation refused under `allowBuilds` (pnpm >= 10 wording). */
const ALLOW_BUILDS_PATTERNS = [
	/allowBuilds/i,
	/Ignored build scripts/i,
	/approve-builds/i,
	/build scripts of .* were blocked/i
];
/** Manager-relative owned files the journal snapshots before every mutation. */
const OWNED_RELATIVE_FILES$1 = [
	"registry.json",
	"runtime-layer.yml",
	"../package.json",
	"../pnpm-lock.yaml"
];
/** Whether one pnpm failure output carries an allowBuilds refusal. */
function isAllowBuildsFailure(output) {
	return ALLOW_BUILDS_PATTERNS.some((pattern) => pattern.test(output));
}
/**
* Run one journaled lifecycle operation. Installs, enable/disable, hide,
* reorder, and uninstall share the transaction scaffolding: lock, snapshot,
* stage, apply, publish, journal.
*/
var PageAppLifecycle = class {
	deps;
	gate = new PageAppActivationGate();
	/** Aborts the in-flight transaction when the manager fiber unloads. */
	inFlight = new AbortController();
	disposed = false;
	/**
	* @param deps - profile, pnpm seam, runtime, pnpm-workspace path, settlement
	* timeout, and the client-graph revision reader.
	*/
	constructor(deps) {
		this.deps = deps;
	}
	/** The pending targeted activation (null between transactions). */
	get activation() {
		return this.gate;
	}
	/**
	* Abort the in-flight transaction and refuse further mutations. Wired to the
	* manager fiber's effect, so a manager reload cannot orphan a running
	* transaction (the profile lock releases through rollback).
	*/
	dispose() {
		this.disposed = true;
		this.inFlight.abort();
	}
	/**
	* Install one managed package (spec §10.1): pnpm add → resolve → static
	* validation → stage → apply → targeted client acknowledgement → publish.
	* @param source - the validated install source.
	* @param clientInstanceId - the opaque initiating client instance (only it
	* may acknowledge).
	* @param signal - cancellation (aborts pnpm and the acknowledgement wait).
	* @returns the committed registry revision.
	*/
	async install(source, clientInstanceId, signal) {
		return this.withTransaction(async (transactionId, txSignal) => {
			const dependenciesBefore = this.readProfileDependencies();
			const add = await this.deps.executor.run(["add", source.spec], {
				cwd: this.deps.profileDir,
				signal: txSignal
			});
			if (add.exitCode !== 0) {
				if (isAllowBuildsFailure(add.stderr)) throw new PageAppBuildPermissionError(`page-app install: pnpm refused the dependency build scripts; the manager never broadens allowBuilds. pnpm said: ${add.stderr.trim().split("\n").slice(-4).join(" ")}`);
				throw new Error(`page-app install: pnpm add failed: ${add.stderr.trim()}`);
			}
			const staged = this.stageAfterInstall(source, dependenciesBefore);
			await this.writeStagedLayer(staged);
			await this.applyRuntime(staged);
			const request = {
				transactionId,
				clientInstanceId,
				packageName: staged.registry.entries.at(-1)?.packageName ?? "",
				pageId: staged.registry.entries.at(-1)?.page.id ?? "",
				graphRevision: this.deps.clientGraphRev()
			};
			this.gate.open(request);
			this.deps.onActivationRequested?.(request);
			try {
				await this.gate.awaitSettlement(txSignal, this.deps.settlementTimeoutMs);
			} finally {
				this.gate.discard();
			}
			await this.publish(staged.registry);
			return staged.registry.revision;
		}, signal);
	}
	/**
	* Enable or disable one managed page (spec §10.2/§10.3): stage the registry
	* row and the derived layer, apply, and publish. Disable unloads the root;
	* enable remounts it. Never runs pnpm.
	* @param pageId - the managed page id.
	* @param enabled - the new enabled state.
	* @param signal - cancellation.
	* @returns the committed registry revision.
	*/
	async setEnabled(pageId, enabled, signal) {
		return this.withTransaction(async () => {
			const current = await this.requireRegistry();
			const registry = {
				...current,
				revision: current.revision + 1,
				entries: current.entries.map((row) => row.page.id === pageId ? {
					...row,
					enabled,
					updatedAt: (/* @__PURE__ */ new Date()).toISOString()
				} : row)
			};
			const staged = this.stageFromRegistry(registry);
			await this.writeStagedLayer(staged);
			await this.applyRuntime(staged);
			await this.publish(staged.registry);
			return staged.registry.revision;
		}, signal);
	}
	/**
	* Hide one managed page (spec §10.5): presentation only — no runtime layer
	* change, no unload.
	* @param pageId - the managed page id.
	* @param hidden - the new hidden state.
	* @returns the committed registry revision.
	*/
	async setHidden(pageId, hidden) {
		return this.withTransaction(async () => {
			const current = await this.requireRegistry();
			const registry = {
				...current,
				revision: current.revision + 1,
				entries: current.entries.map((row) => row.page.id === pageId ? {
					...row,
					hidden,
					updatedAt: (/* @__PURE__ */ new Date()).toISOString()
				} : row)
			};
			await this.publish(registry);
			return registry.revision;
		}, new AbortController().signal);
	}
	/**
	* Reorder managed pages (spec §10.5): presentation only.
	* @param pageIds - page ids in the desired order (rows not listed keep their relative order after them).
	* @returns the committed registry revision.
	*/
	async reorder(pageIds) {
		return this.withTransaction(async () => {
			const current = await this.requireRegistry();
			const byId = new Map(current.entries.map((row) => [row.page.id, row]));
			for (const id of pageIds) if (!byId.has(id)) throw new Error(`page-app reorder: unknown page id "${id}"`);
			const ordered = [];
			for (const id of pageIds) {
				const row = byId.get(id);
				if (row !== void 0) ordered.push(row);
			}
			const rest = current.entries.filter((row) => !pageIds.includes(row.page.id));
			const entries = ordered.concat(rest).map((row, index) => ({
				...row,
				order: index + 1
			}));
			const registry = {
				...current,
				revision: current.revision + 1,
				entries
			};
			await this.publish(registry);
			return registry.revision;
		}, new AbortController().signal);
	}
	/**
	* Uninstall one managed page (spec §10.4): disable/unload sequence, pnpm
	* remove, remove the row, publish. The manager never deletes the original
	* local source or the pnpm global store.
	* @param pageId - the managed page id.
	* @param signal - cancellation.
	* @returns the committed registry revision.
	*/
	async uninstall(pageId, signal) {
		return this.withTransaction(async (_transactionId, txSignal) => {
			const current = await this.requireRegistry();
			const row = current.entries.find((entry) => entry.page.id === pageId);
			if (row === void 0) throw new Error(`page-app uninstall: unknown page id "${pageId}"`);
			const disabled = {
				...current,
				entries: current.entries.map((entry) => entry.page.id === pageId ? {
					...entry,
					enabled: false
				} : entry)
			};
			const staged = this.stageFromRegistry(disabled);
			await this.writeStagedLayer(staged);
			await this.applyRuntime(staged);
			const removed = await this.deps.executor.run(["remove", row.packageName], {
				cwd: this.deps.profileDir,
				signal: txSignal
			});
			if (removed.exitCode !== 0) throw new Error(`page-app uninstall: pnpm remove failed: ${removed.stderr.trim()}`);
			const final = this.stageFromRegistry({
				...disabled,
				revision: disabled.revision + 1,
				entries: disabled.entries.filter((entry) => entry.page.id !== pageId)
			});
			await this.writeStagedLayer(final);
			await this.publish(final.registry);
			return final.registry.revision;
		}, signal);
	}
	async withTransaction(body, signal) {
		if (this.disposed) throw new Error("page-app transaction: the manager has been disposed; no new mutations");
		const token = randomUUID();
		return withPageAppProfileLock(this.deps.profileDir, {
			kind: "manager",
			token
		}, async () => {
			if (await readPageAppJournal(this.deps.profileDir) !== null) throw new Error("page-app transaction: a journal exists; run recover() first (recovery-required)");
			const merged = new AbortController();
			if (signal.aborted || this.inFlight.signal.aborted) merged.abort();
			const onCallerAbort = () => {
				merged.abort();
			};
			const onLifecycleAbort = () => {
				merged.abort();
			};
			signal.addEventListener("abort", onCallerAbort, { once: true });
			this.inFlight.signal.addEventListener("abort", onLifecycleAbort, { once: true });
			try {
				const files = await snapshotPageAppJournalFiles(this.deps.profileDir, OWNED_RELATIVE_FILES$1);
				const prepared = Object.freeze({
					schemaVersion: 1,
					phase: "prepared",
					lockOwnerToken: token,
					files
				});
				await writePageAppJournal(this.deps.profileDir, prepared);
				try {
					const result = await body(token, merged.signal);
					await removePageAppJournal(this.deps.profileDir);
					return result;
				} catch (error) {
					await this.rollback(token, error);
					throw error;
				}
			} finally {
				signal.removeEventListener("abort", onCallerAbort);
				this.inFlight.signal.removeEventListener("abort", onLifecycleAbort);
			}
		});
	}
	/** Stage the next registry + derived layer after a successful pnpm add. */
	stageAfterInstall(source, dependenciesBefore) {
		const registry = this.requireRegistrySync();
		const packageName = this.resolveInstalledPackageKey(source, dependenciesBefore, this.readProfileDependencies());
		const record = validateInstalledPageAppPackage(this.deps.profileDir, packageName, {
			profileDir: this.deps.profileDir,
			registry,
			baseRootIds: [],
			profileDependencies: this.readProfileDependencies(),
			profileBundles: []
		});
		const manifest = record.manifest;
		const entry = {
			packageName,
			source: source.display,
			resolvedVersion: record.version,
			page: {
				id: manifest.id,
				name: manifest.name,
				description: manifest.description,
				defaultOrder: manifest.defaultOrder,
				rootEntryId: manifest.rootEntryId
			},
			order: manifest.defaultOrder,
			enabled: true,
			hidden: false,
			installedAt: (/* @__PURE__ */ new Date()).toISOString(),
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		const next = registry === null ? {
			schemaVersion: 1,
			revision: 1,
			entries: [entry]
		} : {
			...registry,
			revision: registry.revision + 1,
			entries: [...registry.entries, entry]
		};
		return this.stageFromRegistry(next);
	}
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
	resolveInstalledPackageKey(source, before, after) {
		if (source.kind === "registry") {
			const bare = source.spec.replace(/^npm:/, "");
			if (after[bare] !== void 0) return bare;
		}
		const candidates = Object.keys(after).filter((key) => before[key] === void 0 || before[key] !== after[key]).sort();
		const [candidate] = candidates;
		if (candidates.length !== 1 || candidate === void 0) {
			const detail = candidates.length === 0 ? "produced no direct profile dependency change" : `changed ${candidates.length} direct profile dependencies (${candidates.join(", ")})`;
			throw new Error(`page-app install: pnpm add ${detail} for source "${source.display.display}"; exactly one added or changed dependency key is required to resolve the installed package`);
		}
		return candidate;
	}
	/** Derive the layer for a staged registry (enabled, statically valid rows only). */
	stageFromRegistry(registry) {
		const roots = [];
		const expectedRoots = [];
		for (const entry of registry.entries) {
			if (!entry.enabled) continue;
			const row = composedManagedRow(this.deps.profileDir, entry, registry, this.readProfileDependencies());
			if (row === void 0) continue;
			const wrapper = managedRootWrapperRow({
				packageName: entry.packageName,
				pageId: entry.page.id,
				rootEntryId: row.rootEntryId,
				contractVersion: row.contractVersion,
				entries: [row.rootRow]
			});
			roots.push({
				packageName: entry.packageName,
				pageId: entry.page.id,
				rootEntryId: wrapper.id,
				enabled: true,
				entries: [wrapper]
			});
			expectedRoots.push({
				packageName: entry.packageName,
				pageId: entry.page.id,
				rootEntryId: wrapper.id,
				hash: managedRootHash(wrapper)
			});
		}
		return {
			registry,
			layer: roots.length > 0 ? renderPageAppRuntimeLayer(roots) : "[]\n",
			expectedRoots
		};
	}
	/** Write the staged runtime layer file, then advance the journal to staged. */
	async writeStagedLayer(staged) {
		writeFileSync(resolvePageAppProfilePaths(this.deps.profileDir).runtimeLayer, staged.layer);
		await this.advanceTo("staged");
	}
	/** Apply the staged layer through the acknowledged profile runtime. */
	async applyRuntime(staged) {
		await this.deps.runtime.applyManagerLayer({
			registryRevision: staged.registry.revision,
			runtimeLayer: staged.layer,
			expectedRoots: staged.expectedRoots
		});
	}
	/** Publish the registry and advance the journal to committing. */
	async publish(registry) {
		await writePageAppRegistry(this.deps.profileDir, registry);
		await this.advanceTo("committing");
		this.deps.onChanged?.(registry.revision);
	}
	/** Re-read the durable journal and walk it forward to the target phase (never a stale in-memory object). */
	async advanceTo(target) {
		const current = await readPageAppJournal(this.deps.profileDir);
		if (current === null) throw new Error("page-app transaction: journal missing while advancing");
		let journal = current;
		while (journal.phase !== target) journal = advancePageAppJournalPhase(journal, journal.phase === "prepared" ? "staged" : "committing");
		await writePageAppJournal(this.deps.profileDir, journal);
	}
	/** Restore before-state and converge; a failed convergence retains the journal. */
	async rollback(token, cause) {
		try {
			const journal = await readPageAppJournal(this.deps.profileDir);
			if (journal !== null && journal.lockOwnerToken !== token) throw new Error("page-app rollback: journal owner token mismatch");
			if (journal !== null) await this.restoreLiveLayer(journal);
			const files = journal?.files ?? {};
			for (const [relative, state] of Object.entries(files)) {
				const paths = resolvePageAppProfilePaths(this.deps.profileDir);
				const absolute = relative === "registry.json" || relative === "runtime-layer.yml" ? join(paths.directory, relative) : join(this.deps.profileDir, relative.replace(/^\.\.\//, ""));
				if (state.present) try {
					writeFileSync(absolute, await readFile(`${absolute}.backup`, "utf8"));
				} catch {}
				else await rm(absolute, { force: true });
			}
			const converge = await this.deps.executor.run(["install"], {
				cwd: this.deps.profileDir,
				signal: new AbortController().signal
			});
			if (converge.exitCode !== 0) throw new Error(`page-app rollback: pnpm install convergence failed (${converge.stderr.trim()}); journal retained`);
		} catch (rollbackError) {
			throw new Error(`page-app transaction failed (${String(cause instanceof Error ? cause.message : cause)}) and rollback is incomplete (${String(rollbackError instanceof Error ? rollbackError.message : rollbackError)}); managerState = recovery-required`);
		}
	}
	/**
	* Restore the prior manager-layer generation the journal recorded: stage the
	* before layer, recompute its expected-root hashes from the before registry,
	* and await the runtime's restore audit. A restore failure propagates so the
	* journal stays and recovery-required is reported.
	*/
	async restoreLiveLayer(journal) {
		const paths = resolvePageAppProfilePaths(this.deps.profileDir);
		let registry = null;
		if (journal.files["registry.json"]?.present === true) try {
			registry = parsePageAppRegistry(JSON.parse(await readFile(`${paths.registry}.backup`, "utf8")));
		} catch {}
		let runtimeLayer = "[]\n";
		if (journal.files["runtime-layer.yml"]?.present === true) try {
			runtimeLayer = await readFile(`${paths.runtimeLayer}.backup`, "utf8");
		} catch {}
		writeFileSync(paths.runtimeLayer, runtimeLayer);
		await this.deps.runtime.restoreManagerLayer({
			registryRevision: registry?.revision ?? 0,
			runtimeLayer,
			expectedRoots: registry === null ? [] : derivePageAppExpectedRoots(this.deps.profileDir, registry)
		});
	}
	async requireRegistry() {
		const registry = await readPageAppRegistry(this.deps.profileDir);
		if (registry === null) throw new Error("page-app: no registry has been published");
		return registry;
	}
	requireRegistrySync() {
		try {
			return JSON.parse(readFileSync(resolvePageAppProfilePaths(this.deps.profileDir).registry, "utf8"));
		} catch {
			return null;
		}
	}
	readProfileDependencies() {
		try {
			return JSON.parse(readFileSync(join(this.deps.profileDir, "package.json"), "utf8")).dependencies ?? {};
		} catch {
			return {};
		}
	}
};
/** The strict validator's composed root of one enabled registry row, when healthy. */
function composedManagedRow(profileDir, entry, registry, profileDependencies) {
	const installed = resolveInstalledPackageDir(profileDir, entry.packageName);
	if (installed === void 0) return void 0;
	try {
		if (typeof JSON.parse(readFileSync(join(installed, "package.json"), "utf8")).dsh?.bundle?.patch !== "string") return void 0;
		const record = validateInstalledPageAppPackage(profileDir, entry.packageName, {
			profileDir,
			registry: {
				...registry,
				entries: registry.entries.filter((row) => row.packageName !== entry.packageName)
			},
			baseRootIds: [],
			profileDependencies,
			profileBundles: []
		});
		return {
			rootEntryId: record.rootEntryId,
			rootRow: record.rootRow,
			contractVersion: record.manifest.schemaVersion
		};
	} catch {
		return;
	}
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
function derivePageAppExpectedRoots(profileDir, registry) {
	const profileDependencies = readProfileDependenciesFrom(profileDir);
	const expectedRoots = [];
	for (const entry of registry.entries) {
		if (!entry.enabled) continue;
		const row = composedManagedRow(profileDir, entry, registry, profileDependencies);
		if (row === void 0) continue;
		const wrapper = managedRootWrapperRow({
			packageName: entry.packageName,
			pageId: entry.page.id,
			rootEntryId: row.rootEntryId,
			contractVersion: row.contractVersion,
			entries: [row.rootRow]
		});
		expectedRoots.push({
			packageName: entry.packageName,
			pageId: entry.page.id,
			rootEntryId: wrapper.id,
			hash: managedRootHash(wrapper)
		});
	}
	return expectedRoots;
}
function readProfileDependenciesFrom(profileDir) {
	try {
		return JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8")).dependencies ?? {};
	} catch {
		return {};
	}
}
//#endregion
//#region lib/types/executor.js
/**
* Profile-local pnpm execution: one thin, injectable wrapper around execa so
* transactions can run, fake, cancel, and diagnose pnpm without ever
* concatenating user input into a shell command. Arguments travel as an
* array; on Windows execa resolves `pnpm` to `pnpm.cmd` itself (the test pins
* the array-call shape, never a joined string).
* @module @deepseek-ai/dsh-page-app-manager/executor
*/
/** Error thrown when the caller's AbortSignal fired mid-command. */
var PageAppCommandAbortedError = class extends Error {
	constructor() {
		super("page-app: pnpm command aborted");
	}
};
/**
* Build the production pnpm executor. Windows `.cmd` resolution is execa's
* own PATH walk — the manager never builds a shell command.
* @param spawn - injectable execa binding (defaults to execa with reject:false).
* @returns the executor.
*/
function createPnpmExecutor(spawn) {
	const exec = spawn ?? (async (file, args, options) => {
		const { execa } = await import("./execa-DrfvJWxZ.js");
		return await execa(file, args, options);
	});
	return { async run(args, options) {
		try {
			const result = await exec("pnpm", [...args], {
				cwd: options.cwd,
				cancelSignal: options.signal,
				reject: false
			});
			return {
				exitCode: result.exitCode ?? 0,
				stdout: result.stdout.slice(0, 64e3),
				stderr: result.stderr.slice(0, 64e3)
			};
		} catch (error) {
			if (error?.name === "AbortError") throw new PageAppCommandAbortedError();
			return {
				exitCode: 1,
				stdout: "",
				stderr: String(error)
			};
		}
	} };
}
//#endregion
//#region lib/types/recovery.js
/**
* Startup transaction recovery: decide a durable journal's fate without
* guessing. The registry file is the commit marker — the transaction publishes
* it only at the commit boundary, so its state against the journal's recorded
* before-state decides the outcome:
*
* - registry changed and the journal reached `committing` → the commit
*   completed; finish it by removing the journal (complete-commit).
* - registry unchanged → no commit happened; restore every recorded
*   before-state (backups), run the inverse/convergence pnpm path, and remove
*   the journal (restore-before-state).
* - registry changed at any earlier phase, or the registry is unreadable, or
*   both recorded sides changed in a way the phase cannot explain → fail
*   closed with recovery-required (never guess).
*
* The dead-owner lock takeover lives in the profile core
* (`recoverOrphanedPageAppLock`); this module runs after it, inside the
* manager's recovery operation.
* @module @deepseek-ai/dsh-page-app-manager/recovery
*/
/** Manager-relative owned files (mirrors the transaction journal list). */
const OWNED_RELATIVE_FILES = [
	"registry.json",
	"runtime-layer.yml",
	"../package.json",
	"../pnpm-lock.yaml"
];
/** Absolute path of one manager-relative owned file inside the profile. */
function absoluteOf(profileDir, relative) {
	const paths = resolvePageAppProfilePaths(profileDir);
	return relative === "registry.json" || relative === "runtime-layer.yml" ? join(paths.directory, relative) : join(profileDir, relative.replace(/^\.\.\//, ""));
}
async function sha256Of(path) {
	try {
		return createHash("sha256").update(await readFile(path, "utf8")).digest("hex");
	} catch {
		return;
	}
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
async function recoverPageAppTransaction(profileDir, executor, runtime) {
	return withPageAppProfileLock(profileDir, {
		kind: "manager",
		token: randomUUID()
	}, async () => {
		const journal = await readPageAppJournal(profileDir);
		if (journal === null) return { action: "none" };
		const before = journal.files["registry.json"];
		if (before === void 0) return {
			action: "recovery-required",
			message: "page-app recovery: the journal records no registry file; operator review required"
		};
		const current = await sha256Of(absoluteOf(profileDir, "registry.json"));
		if (current === void 0 && before.present) return {
			action: "recovery-required",
			message: "page-app recovery: the registry file is unreadable and the journal cannot be decided"
		};
		if (before.present ? current !== before.sha256 : current !== void 0) {
			if (journal.phase !== "committing") return {
				action: "recovery-required",
				message: `page-app recovery: the registry changed at journal phase "${journal.phase}" — an external writer or a torn commit; operator review required`
			};
			await removePageAppJournal(profileDir);
			return { action: "commit-completed" };
		}
		const restored = await restoreLiveLayer(profileDir, journal, runtime);
		if (restored !== void 0) return restored;
		try {
			for (const [relative, state] of Object.entries(journal.files)) {
				const absolute = absoluteOf(profileDir, relative);
				if (state.present) {
					const backup = `${absolute}.backup`;
					try {
						await writeFile(absolute, await readFile(backup, "utf8"));
					} catch (error) {
						return {
							action: "recovery-required",
							message: `page-app recovery: failed to restore ${relative} (${String(error)}); journal retained`
						};
					}
				} else await rm(absolute, { force: true });
			}
			const converge = await executor.run(["install"], {
				cwd: profileDir,
				signal: new AbortController().signal
			});
			if (converge.exitCode !== 0) return {
				action: "recovery-required",
				message: `page-app recovery: pnpm install convergence failed (${converge.stderr.trim()}); journal retained`
			};
			await removePageAppJournal(profileDir);
			return { action: "restored" };
		} catch (error) {
			return {
				action: "recovery-required",
				message: `page-app recovery: restore failed (${String(error)}); journal retained`
			};
		}
	});
}
/** Restore the journal's before layer through the runtime; undefined = success. */
async function restoreLiveLayer(profileDir, journal, runtime) {
	const paths = resolvePageAppProfilePaths(profileDir);
	let registry = null;
	if (journal.files["registry.json"]?.present === true) try {
		registry = parsePageAppRegistry(JSON.parse(await readFile(`${paths.registry}.backup`, "utf8")));
	} catch {}
	let runtimeLayer = "[]\n";
	if (journal.files["runtime-layer.yml"]?.present === true) try {
		runtimeLayer = await readFile(`${paths.runtimeLayer}.backup`, "utf8");
	} catch {}
	await writeFile(paths.runtimeLayer, runtimeLayer);
	try {
		await runtime.restoreManagerLayer({
			registryRevision: registry?.revision ?? 0,
			runtimeLayer,
			expectedRoots: registry === null ? [] : derivePageAppExpectedRoots(profileDir, registry)
		});
		return;
	} catch (error) {
		return {
			action: "recovery-required",
			message: `page-app recovery: live layer restore failed (${String(error)}); journal retained`
		};
	}
}
/** The owned-file list is exported for the recovery-table tests. */
const RECOVERY_OWNED_FILES = OWNED_RELATIVE_FILES;
//#endregion
//#region lib/types/workbench-runtime.js
/**
* Workbench Runtime (design D4): the Host service a Feature Runtime Wrapper
* injects and the only surface a Feature reaches through. The runtime carries
* the minimal contract-v1 domain API — lifecycle disposal, workspace-surface
* registration, events, storage get/set, and a host call seam — and is
* provided under {@link WORKBENCH_RUNTIME_SERVICE} by the manager fiber, so
* disposer removal deletes the service and Cordis re-evaluates every dependent
* wrapper fiber (provider loss parks them PENDING; re-provide reloads them).
* Every registered side effect is owned by the runtime's fiber and released in
* reverse mount order when the fiber unloads. The contract's client render
* wiring lands with the fixture migration (M9); this host half records the
* surface seat and its owning package provenance.
* @module @deepseek-ai/dsh-page-app-manager/workbench-runtime
*/
/** The service name the manager provides the Workbench Runtime under. */
const WORKBENCH_RUNTIME_SERVICE = "workbenchRuntime";
/**
* Build the Workbench Runtime for one manager fiber. The runtime's ctx effect
* owns every registered side effect: when the fiber unloads, disposer-owned
* callbacks, surface seats, listeners, and storage release together, and the
* service unregistration (Cordis's provide disposer) re-evaluates dependent
* wrapper fibers.
* @param ctx - the manager's plugin context (the providing fiber).
* @returns the Feature-facing domain API.
*/
function createWorkbenchRuntime(ctx) {
	const disposeCallbacks = /* @__PURE__ */ new Set();
	const surfaceSeats = /* @__PURE__ */ new Map();
	const listeners = /* @__PURE__ */ new Map();
	const store = /* @__PURE__ */ new Map();
	const release = () => {
		for (const callback of [...disposeCallbacks]) try {
			callback();
		} catch {}
		disposeCallbacks.clear();
		surfaceSeats.clear();
		listeners.clear();
		store.clear();
	};
	ctx.effect(() => release, `${WORKBENCH_RUNTIME_SERVICE}: release every registered Workbench side effect with the manager fiber`);
	return {
		lifecycle: { onDispose: (callback) => {
			disposeCallbacks.add(callback);
			return () => {
				disposeCallbacks.delete(callback);
			};
		} },
		surfaces: {
			registerWorkspaceSurface: (registration) => {
				surfaceSeats.set(registration.pageId, Object.freeze({ ...registration }));
				return () => {
					surfaceSeats.delete(registration.pageId);
				};
			},
			list: () => [...surfaceSeats.values()]
		},
		events: {
			on: (name, listener) => {
				const existing = listeners.get(name);
				const set = existing ?? /* @__PURE__ */ new Set();
				if (existing === void 0) listeners.set(name, set);
				set.add(listener);
				return () => {
					set.delete(listener);
				};
			},
			emit: (name, payload) => {
				for (const listener of [...listeners.get(name) ?? []]) listener(payload);
			}
		},
		storage: {
			get: (key) => store.get(key),
			set: (key, value) => {
				store.set(key, value);
			}
		},
		host: { call: (method, ..._args) => {
			throw new Error(`page-app workbench: no host method "${method}" is wired (contract v1 wires host capabilities with the fixture migration)`);
		} }
	};
}
//#endregion
//#region lib/types/index.js
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
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** Derive one row's health from current dependency/version/runtime facts. */
function deriveHealth(entry, facts) {
	if (!entry.enabled) return { health: "disabled" };
	if (facts.installedVersion === void 0) return {
		health: "missing-dependency",
		lastError: "the package dependency is not installed in this profile"
	};
	if (facts.installedVersion !== entry.resolvedVersion) return {
		health: "version-drift",
		lastError: `installed ${facts.installedVersion} does not match committed ${entry.resolvedVersion}`
	};
	if (!facts.manifestValid || !facts.bundleValid) return {
		health: "invalid-manifest",
		lastError: "the installed package no longer satisfies the Workspace Plugin Contract"
	};
	if (!facts.wrapperResolvable) return {
		health: "missing-manager",
		lastError: "the page-app manager wrapper is not installed in this profile"
	};
	if (facts.loaderRow === void 0) return {
		health: "activation-failed",
		lastError: "the managed wrapper row is not mounted with an active fiber in the runtime tree"
	};
	const runtimeState = fiberStateLabelOf(facts.loaderRow.fiberState);
	const label = runtimeState === void 0 ? {} : { runtimeState };
	if (!isActiveFiberState(facts.loaderRow.fiberState)) return {
		health: "activation-failed",
		lastError: "the managed wrapper row is not mounted with an active fiber in the runtime tree",
		...label
	};
	if (!facts.loaderRow.hashMatches) return {
		health: "externally-overridden",
		lastError: "a user patch configures, disables, or replaces the managed wrapper row",
		...label
	};
	return {
		health: "ready",
		...label
	};
}
/** Sync read of the ownership authority; a missing file is a normal empty state. */
function readRegistrySync(profileDir) {
	const paths = resolvePageAppProfilePaths(profileDir);
	let content;
	try {
		content = readFileSync(paths.registry, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") return { registry: null };
		return {
			registry: null,
			recoveryError: `page-app registry is unreadable; managed roots failed closed: ${String(error)}`
		};
	}
	try {
		return { registry: parsePageAppRegistry(JSON.parse(content)) };
	} catch (error) {
		return {
			registry: null,
			recoveryError: `page-app registry is corrupt; managed roots failed closed: ${String(error)}`
		};
	}
}
/**
* Build the Host page-app manager service. Extends `TypertRemoteService` so the
* generated `pageAppManager` namespace exposes the mutation API; the read
* projection and staged validation are plain methods on the same service.
* @param ctx - plugin context with the Loader available.
* @param options - the launcher-provided profile runtime (identity source).
*/
let PageAppManager = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _list_decorators;
	let _install_decorators;
	let _setEnabled_decorators;
	let _setHidden_decorators;
	let _reorder_decorators;
	let _uninstall_decorators;
	let _ackClientActivation_decorators;
	let _recover_decorators;
	return class PageAppManager extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_list_decorators = [Remote("list")];
			_install_decorators = [Remote("installPackage")];
			_setEnabled_decorators = [Remote("setEnabled")];
			_setHidden_decorators = [Remote("setHidden")];
			_reorder_decorators = [Remote("reorder")];
			_uninstall_decorators = [Remote("uninstall")];
			_ackClientActivation_decorators = [Remote("ackClientActivation")];
			_recover_decorators = [Remote("recover")];
			__esDecorate(this, null, _list_decorators, {
				kind: "method",
				name: "list",
				static: false,
				private: false,
				access: {
					has: (obj) => "list" in obj,
					get: (obj) => obj.list
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _install_decorators, {
				kind: "method",
				name: "install",
				static: false,
				private: false,
				access: {
					has: (obj) => "install" in obj,
					get: (obj) => obj.install
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _setEnabled_decorators, {
				kind: "method",
				name: "setEnabled",
				static: false,
				private: false,
				access: {
					has: (obj) => "setEnabled" in obj,
					get: (obj) => obj.setEnabled
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _setHidden_decorators, {
				kind: "method",
				name: "setHidden",
				static: false,
				private: false,
				access: {
					has: (obj) => "setHidden" in obj,
					get: (obj) => obj.setHidden
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _reorder_decorators, {
				kind: "method",
				name: "reorder",
				static: false,
				private: false,
				access: {
					has: (obj) => "reorder" in obj,
					get: (obj) => obj.reorder
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _uninstall_decorators, {
				kind: "method",
				name: "uninstall",
				static: false,
				private: false,
				access: {
					has: (obj) => "uninstall" in obj,
					get: (obj) => obj.uninstall
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _ackClientActivation_decorators, {
				kind: "method",
				name: "ackClientActivation",
				static: false,
				private: false,
				access: {
					has: (obj) => "ackClientActivation" in obj,
					get: (obj) => obj.ackClientActivation
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _recover_decorators, {
				kind: "method",
				name: "recover",
				static: false,
				private: false,
				access: {
					has: (obj) => "recover" in obj,
					get: (obj) => obj.recover
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		profileRuntime = __runInitializers(this, _instanceExtraInitializers);
		lifecycle;
		constructor(ctx, options) {
			super(ctx, "pageAppManager");
			this.profileRuntime = options.profileRuntime;
			this.lifecycle = new PageAppLifecycle({
				profileDir: this.profileRuntime.identity.directory,
				executor: options.executor ?? createPnpmExecutor(),
				runtime: this.profileRuntime,
				pnpmWorkspaceFile: join(this.profileRuntime.identity.directory, "pnpm-workspace.yaml"),
				settlementTimeoutMs: options.config.settlementTimeoutMs,
				clientGraphRev: () => {
					const modules = ctx.get("clientModules");
					if (modules === void 0) throw new Error("page-app install: the host client-modules registry is unavailable; cannot converge the activation graph");
					return modules.graph().rev;
				},
				onChanged: (revision) => {
					ctx.emit("page-app-manager/changed", revision);
				},
				onActivationRequested: (request) => {
					ctx.emit("page-app-manager/activation-requested", request);
				}
			});
		}
		/** The immutable active-profile identity (consumers cannot replace it). */
		get identity() {
			return this.profileRuntime.identity;
		}
		/** The pending targeted client activation gate (install acknowledgement). */
		get activation() {
			return this.lifecycle.activation;
		}
		/** Abort the in-flight transaction; wired to the manager fiber's effect. */
		dispose() {
			this.lifecycle.dispose();
		}
		/**
		* The full read-only projection of the managed set. The registry is the
		* ownership authority; health is derived from current dependency, version,
		* and runtime facts. Plugin Inventory and unrelated Loader rows never create
		* entries.
		* @returns the immutable snapshot.
		*/
		list() {
			return this.snapshot();
		}
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
		install(source, clientInstanceId, signal) {
			return this.lifecycle.install(source, clientInstanceId, signal);
		}
		/**
		* Enable or disable one managed page.
		* @param pageId - the managed page id.
		* @param enabled - the new enabled state.
		* @param signal - cancellation; honored by the shared lock.
		* @returns the committed registry revision.
		*/
		setEnabled(pageId, enabled, signal) {
			return this.lifecycle.setEnabled(pageId, enabled, signal);
		}
		/**
		* Hide or show one managed page (presentation only).
		* @param pageId - the managed page id.
		* @param hidden - the new hidden state.
		* @returns the committed registry revision.
		*/
		setHidden(pageId, hidden) {
			return this.lifecycle.setHidden(pageId, hidden);
		}
		/**
		* Reorder managed pages.
		* @param pageIds - page ids in the desired order.
		* @returns the committed registry revision.
		*/
		reorder(pageIds) {
			return this.lifecycle.reorder(pageIds);
		}
		/**
		* Uninstall one managed page from the current profile.
		* @param pageId - the managed page id.
		* @param signal - cancellation; aborts pnpm and the activation wait.
		* @returns the committed registry revision.
		*/
		uninstall(pageId, signal) {
			return this.lifecycle.uninstall(pageId, signal);
		}
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
		ackClientActivation(transactionId, clientInstanceId, packageName, pageId, graphRevision) {
			const result = this.lifecycle.activation.acknowledge(transactionId, clientInstanceId, packageName, pageId, graphRevision);
			return {
				accepted: result.accepted,
				...result.reason === void 0 ? {} : { reason: result.reason }
			};
		}
		/**
		* Run the startup/operator recovery over the profile journal.
		* @returns the recovery outcome.
		*/
		recover() {
			return recoverPageAppTransaction(this.profileRuntime.identity.directory, createPnpmExecutor(), this.profileRuntime).then((outcome) => ({
				action: outcome.action,
				...outcome.message === void 0 ? {} : { message: outcome.message }
			}));
		}
		/**
		* The full read-only projection of the managed set (the `list` Remote
		* delegates here; the raw method stays available to host-side consumers).
		* @returns the immutable snapshot.
		*/
		snapshot() {
			const profile = this.profileRuntime.identity;
			const { registry, recoveryError } = readRegistrySync(profile.directory);
			const recoveryVisible = recoveryError !== void 0;
			const operation = readJournalOperation(profile.directory, recoveryVisible);
			const loader = this.ctx.get("loader");
			const entries = registry === null ? [] : registry.entries.map((row) => Object.freeze(this.viewOf(row, loader)));
			return Object.freeze({
				profile: Object.freeze({ ...profile }),
				revision: registry?.revision ?? 0,
				entries: Object.freeze(entries),
				operation,
				recovery: recoveryVisible ? Object.freeze({ message: recoveryError }) : null
			});
		}
		/**
		* Parse and classify one Settings add-flow source spec. Local directory
		* sources are additionally preflighted against the on-disk package; registry,
		* git, link, and tarball sources await the pnpm staging step (Task 8) before
		* the full static validation runs. Never mutates ownership.
		* @param source - the raw specifier (or an already-typed source).
		* @returns the validated install source plus a preflight note.
		* @throws {Error} when the spec is rejected (kind grammar, credentials, relative path).
		*/
		validateInstall(source) {
			const parsed = typeof source === "string" ? parsePageAppInstallSource(source) : source;
			if (parsed.kind !== "file") return {
				source: parsed,
				preflight: "pnpm staging required before static validation (transaction task)"
			};
			try {
				const pkg = JSON.parse(readFileSync(join(parsed.spec, "package.json"), "utf8"));
				if (typeof pkg.name !== "string" || pkg.name === "" || typeof pkg.dsh?.workspace !== "object" || pkg.dsh.workspace === null) throw new Error("no name or dsh.workspace block");
				return {
					source: parsed,
					preflight: null
				};
			} catch (error) {
				throw new Error(`page-app install source: ${parsed.spec} is not a valid workspace package: ${String(error)}`);
			}
		}
		/** Project one registry row into its view with derived health. */
		viewOf(row, loader) {
			const profile = this.profileRuntime.identity;
			const nodeModules = join(profile.directory, "node_modules", row.packageName);
			const { health, runtimeState, lastError } = deriveHealth(row, this.factsOf(row, nodeModules, loader));
			return Object.freeze({
				packageName: row.packageName,
				source: row.source,
				resolvedVersion: row.resolvedVersion,
				page: row.page,
				order: row.order,
				enabled: row.enabled,
				hidden: row.hidden,
				installedAt: row.installedAt,
				updatedAt: row.updatedAt,
				health,
				...runtimeState === void 0 ? {} : { runtimeState },
				...lastError === void 0 ? {} : { lastError }
			});
		}
		/** Collect the current dependency/version/manifest/bundle/runtime facts of one row. */
		factsOf(row, packageDir, loader) {
			let installedPkg;
			try {
				installedPkg = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
			} catch {
				installedPkg = void 0;
			}
			const installedVersion = typeof installedPkg?.version === "string" ? installedPkg.version : void 0;
			if (installedPkg === void 0 || installedVersion !== row.resolvedVersion) return {
				installedVersion,
				manifestValid: false,
				bundleValid: false,
				wrapperResolvable: false,
				expectedRootHash: void 0,
				loaderRow: void 0
			};
			let manifestValid = true;
			let contractVersion = 1;
			try {
				contractVersion = parsePageAppManifest(row.packageName, installedPkg).schemaVersion;
			} catch {
				manifestValid = false;
			}
			let bundleValid = true;
			let expectedRootHash;
			const patch = installedPkg.dsh?.bundle?.patch;
			try {
				if (typeof patch !== "string" || patch === "") throw new Error("no bundle patch");
				const rootRow = composePatchRows(loadOverlayPatches("page-app", join(packageDir, patch))).find((candidate) => candidate.id === row.page.rootEntryId);
				if (rootRow === void 0) throw new Error("root row missing");
				expectedRootHash = managedRootHash(managedRootWrapperRow({
					packageName: row.packageName,
					pageId: row.page.id,
					rootEntryId: row.page.rootEntryId,
					contractVersion,
					entries: [rootRow]
				}));
			} catch {
				bundleValid = false;
			}
			let loaderRow;
			if (loader === void 0 || expectedRootHash === void 0) loaderRow = void 0;
			else {
				const found = findLoaderRow(loader, managedRootWrapperId(row.page.id));
				loaderRow = found === void 0 ? void 0 : {
					fiberState: fiberStateOf(found),
					hashMatches: managedRootHash(found.options) === expectedRootHash
				};
			}
			return {
				installedVersion,
				manifestValid,
				bundleValid,
				wrapperResolvable: managerWrapperResolvable(this.profileRuntime.identity.directory),
				expectedRootHash,
				loaderRow
			};
		}
	};
})();
/** Operation state projected per journal phase (the mapping table; every phase maps, so an invalid combination is a projection bug). */
const OPERATION_STATE_BY_PHASE = {
	prepared: "installing",
	staged: "installing",
	committing: "active"
};
/**
* The durable journal phase, when one exists (a missing or unreadable journal —
* the mutation path fails closed on the parser — is no phase).
*/
function readJournalPhase(profileDir) {
	try {
		return parsePageAppJournal(JSON.parse(readFileSync(resolvePageAppProfilePaths(profileDir).journal, "utf8"))).phase;
	} catch {
		return;
	}
}
/**
* Project the in-flight operation view from the durable journal and registry
* recovery facts (mapping table): no journal and no recovery → null;
* prepared/staged → installing; committing → active; a visible recovery →
* recovery-required (carrying the journal phase when one explains it). No
* persisted fields are added; `removing`/`install-failed`/`remove-failed`
* stay members of the closed `PageAppOperationState` union that current facts
* never produce.
* @param profileDir - absolute profile directory (journal resolution anchor).
* @param recoveryVisible - whether the registry read surfaced a recovery error.
* @returns the operation view, or null when nothing is in flight.
*/
function readJournalOperation(profileDir, recoveryVisible) {
	const phase = readJournalPhase(profileDir);
	if (recoveryVisible) return phase === void 0 ? { state: "recovery-required" } : {
		state: "recovery-required",
		phase
	};
	if (phase === void 0) return null;
	return {
		state: OPERATION_STATE_BY_PHASE[phase],
		phase
	};
}
/** Stable Cordis plugin name. */
const name = "page-app-manager";
/** Required services: the launcher-owned profile runtime and the Loader. */
const inject = [PROFILE_RUNTIME_SERVICE, "loader"];
/** Validated plugin config: the Host settlement-wait cap (defaults in the schema). */
const Config = z.object({ settlementTimeoutMs: z.number().int().positive().default(6e4) });
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
function apply(ctx, config) {
	const runtime = ctx.get(PROFILE_RUNTIME_SERVICE);
	ctx.provide(WORKBENCH_RUNTIME_SERVICE$1, createWorkbenchRuntime(ctx));
	const manager = new PageAppManager(ctx, {
		profileRuntime: runtime,
		config: { settlementTimeoutMs: config.settlementTimeoutMs ?? 6e4 }
	});
	ctx.effect(() => () => {
		manager.dispose();
	}, "page-app-manager: abort in-flight transactions when the manager fiber unloads");
}
//#endregion
export { Config, PageAppActivationGate, PageAppBuildPermissionError, PageAppCommandAbortedError, PageAppLifecycle, PageAppManager, RECOVERY_OWNED_FILES, WORKBENCH_RUNTIME_SERVICE, apply, createPnpmExecutor, createWorkbenchRuntime, derivePageAppExpectedRoots, inject, name, parsePageAppInstallSource, recoverPageAppTransaction, resolveInstalledPackageDir, validateInstalledPageAppPackage };
