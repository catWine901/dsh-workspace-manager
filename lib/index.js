import { c as managedRootWrapperId, h as require_zod, l as managedRootWrapperRow, m as require_js_yaml, r as WORKBENCH_RUNTIME_SERVICE$1, s as loadOverlayPatches, t as PROFILE_RUNTIME_SERVICE, u as managerWrapperResolvable } from "./profile-runtime-bridge-BAIkQibq.mjs";
import { a as fiberStateOf, c as managedRootHash, i as fiberStateLabelOf, n as createWorkbenchRuntime, o as findLoaderRow, r as composePatchRows, s as isActiveFiberState, t as WORKBENCH_RUNTIME_SERVICE, u as parseEntryList } from "./workbench-runtime-AOqDkwdX.mjs";
import { WORKSPACE_HOST_ADAPTER_SERVICE } from "./host-bridge.js";
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";

//#region src/profile/paths.ts
var import_zod = require_zod();
/**
* Exact profile-scoped locations of the page-app manager. The directory name
* stays `.workspace-manager` for compatibility with the accepted product
* brief while TypeScript and slot identifiers use page-app terminology.
* @module @deepseek-ai/dsh-page-app-profile/paths
*/
/** The manager directory name inside one profile directory. */
const PAGE_APP_MANAGER_DIRECTORY_NAME = ".workspace-manager";
/** Registry file name inside the manager directory. */
const PAGE_APP_REGISTRY_FILE_NAME = "registry.json";
/** Derived runtime-layer file name inside the manager directory. */
const PAGE_APP_RUNTIME_LAYER_FILE_NAME = "runtime-layer.yml";
/** Active transaction journal file name inside the manager directory. */
const PAGE_APP_JOURNAL_FILE_NAME = "transaction.json";
/** Exclusive profile mutation lock file name inside the manager directory. */
const PAGE_APP_OPERATION_KEY_FILE_NAME = "operation.lock";
/**
* Resolve the exact page-app manager files inside one profile directory. The
* caller owns the profile directory; this function never touches the
* filesystem and never infers the profile from process state.
* @param profileDir - absolute profile directory (`$DSH_HOME/profiles/<profile>`).
* @returns every profile-scoped path the manager resolves.
*/
function resolvePageAppProfilePaths(profileDir) {
	const directory = join(profileDir, PAGE_APP_MANAGER_DIRECTORY_NAME);
	return {
		directory,
		registry: join(directory, PAGE_APP_REGISTRY_FILE_NAME),
		runtimeLayer: join(directory, PAGE_APP_RUNTIME_LAYER_FILE_NAME),
		journal: join(directory, PAGE_APP_JOURNAL_FILE_NAME),
		operationKey: join(directory, PAGE_APP_OPERATION_KEY_FILE_NAME)
	};
}

//#endregion
//#region src/profile/manifest.ts
/**
* Manifest and source parsing for page-app packages. `parsePageAppManifest`
* reads the strict `dsh.workspace` v1 block from a parsed package.json;
* `assertPageAppSourceNoCredentials` rejects install source specs that embed
* credentials in a URL, and `parsePageAppSourceDisplay` derives the redacted
* display the registry may persist.
* @module @deepseek-ai/dsh-page-app-profile/manifest
*/
/**
* Parse `value` with `schema`, throwing one labeled Error whose message names
* the failing path. Parsers across this package share this helper so every
* durable boundary fails loud with a stable, greppable diagnostic.
* @param schema - the strict zod schema to parse with.
* @param value - unvalidated input from a durable or caller boundary.
* @param label - diagnostic prefix naming the boundary (`page-app registry`).
* @returns the validated value.
*/
function parseStrict(schema, value, label) {
	const result = schema.safeParse(value);
	if (!result.success) {
		const issue = result.error.issues[0];
		const where = issue === void 0 ? "(root)" : `${issue.path.join(".") || "(root)"}: ${issue.message}`;
		throw new Error(`${label}: ${where}`);
	}
	return result.data;
}
const workspaceSchema = import_zod.z.object({
	schemaVersion: import_zod.z.literal(1),
	id: import_zod.z.string().min(1),
	name: import_zod.z.string().min(1),
	description: import_zod.z.string().min(1),
	defaultOrder: import_zod.z.number().int(),
	rootEntryId: import_zod.z.string().min(1)
}).strict().readonly();
const packageManifestSchema = import_zod.z.object({ dsh: import_zod.z.object({ workspace: workspaceSchema }) });
/**
* Parse the `dsh.workspace` v1 block out of a parsed package.json. Sibling
* `dsh` keys (`bundle`, `client`) are allowed; the workspace block itself is
* strict and every text field must be non-empty.
* @param packageName - the owning package name, joined into the result.
* @param value - a parsed package.json (unknown at the durable boundary).
* @returns the immutable parsed manifest.
*/
function parsePageAppManifest(packageName, value) {
	const parsed = parseStrict(packageManifestSchema, value, "page-app manifest");
	return Object.freeze({
		packageName,
		schemaVersion: parsed.dsh.workspace.schemaVersion,
		id: parsed.dsh.workspace.id,
		name: parsed.dsh.workspace.name,
		description: parsed.dsh.workspace.description,
		defaultOrder: parsed.dsh.workspace.defaultOrder,
		rootEntryId: parsed.dsh.workspace.rootEntryId
	});
}
/**
* The one opaque-token grammar every lock owner token, lock payload, and
* journal owner token must satisfy. Tokens are interpolated into claim and
* quarantine file names, so separators and traversal would escape the manager
* directory; the grammar is exactly the filename-safe set with no path
* structure and no pure-dot names (`.`/`..` read as path pseudo-segments).
* Callers generate opaque tokens (UUID-style); anything else is rejected at
* every boundary that would persist or path-build with it.
*/
const PAGE_APP_TOKEN_PATTERN = /^(?!\.{1,2}$)[A-Za-z0-9._~-]+$/;
/**
* Reject an opaque owner token that is not filename-safe. Tokens name claim
* and quarantine files, so separators, traversal, and whitespace must fail
* closed before any path is built or any payload is persisted.
* @param token - the owner token to validate.
*/
function assertSafeOpaqueToken(token) {
	if (!PAGE_APP_TOKEN_PATTERN.test(token)) throw new Error(`page-app: unsafe opaque owner token ${JSON.stringify(token)}`);
}
/** A spec that parses as a `scheme:` URL, or null when it is not URL-shaped. */
function urlShape(spec) {
	if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(spec)) return null;
	try {
		return new URL(spec);
	} catch {
		return null;
	}
}
/**
* Reject an install source spec that embeds credentials in a URL. A URL whose
* userinfo carries a username or password is refused outright, because
* credentials must never be persisted; local paths and scp-style git specs
* carry no URL credentials and pass through. Any absolute URL form — with or
* without the `//` host separator — is inspected; only specs that actually
* parse as URLs are checked, so package specs like `npm:pkg` and Windows
* drive-letter paths are never misclassified.
* @param spec - the exact install source spec.
*/
function assertPageAppSourceNoCredentials(spec) {
	const url = urlShape(spec);
	if (url !== null && (url.username !== "" || url.password !== "")) throw new Error("page-app manifest: source spec embeds credentials in a URL and is rejected");
}
/**
* Derive the registry-persisted source record from an install source spec.
* The display is always redacted: URL userinfo is stripped so the persisted
* record can never carry credentials even if a spec bypassed the validation
* step. Only URL-shaped specs are rewritten (host-form URLs are canonicalized
* and any userinfo is removed); local paths and scp-style git specs pass
* through unchanged.
* @param kind - the source kind the manager validated.
* @param spec - the exact install source spec.
* @returns the immutable redacted source record.
*/
function parsePageAppSourceDisplay(kind, spec) {
	const url = urlShape(spec);
	let display = spec;
	if (url !== null) {
		const hasUserinfo = url.username !== "" || url.password !== "";
		const hostForm = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(spec);
		if (hasUserinfo || hostForm) {
			url.username = "";
			url.password = "";
			display = url.toString();
		}
	}
	return Object.freeze({
		kind,
		display
	});
}

//#endregion
//#region src/profile/registry.ts
/**
* Page-app registry schema v1: strict parsing, uniqueness, stable ordering,
* and deeply immutable results, plus atomic registry file IO. The registry is
* the sole ownership authority; every other projection is derived from it.
* @module @deepseek-ai/dsh-page-app-profile/registry
*/
const registrySourceSchema = import_zod.z.object({
	kind: import_zod.z.enum([
		"registry",
		"file",
		"link",
		"tarball",
		"git"
	]),
	display: import_zod.z.string().min(1)
}).strict().readonly();
const pageFieldsSchema = import_zod.z.object({
	id: import_zod.z.string().min(1),
	name: import_zod.z.string().min(1),
	description: import_zod.z.string().min(1),
	defaultOrder: import_zod.z.number().int(),
	rootEntryId: import_zod.z.string().min(1)
}).strict().readonly();
const registryEntrySchema = import_zod.z.object({
	packageName: import_zod.z.string().min(1),
	source: registrySourceSchema,
	resolvedVersion: import_zod.z.string().min(1),
	page: pageFieldsSchema,
	order: import_zod.z.number().int(),
	enabled: import_zod.z.boolean(),
	hidden: import_zod.z.boolean(),
	installedAt: import_zod.z.string().min(1),
	updatedAt: import_zod.z.string().min(1)
}).strict().readonly();
const registrySchema = import_zod.z.object({
	schemaVersion: import_zod.z.literal(1),
	revision: import_zod.z.number().int().nonnegative(),
	entries: import_zod.z.array(registryEntrySchema).readonly()
}).strict().readonly();
/**
* Parse and validate registry schema v1. Unknown versions, wrong types,
* unknown keys, credential-bearing source displays, and duplicate package
* names, page ids, or root entry ids are all rejected; v1 fails closed and
* never reads a newer format. Entries come back in stable order (`order`
* ascending, then package name), and every returned level is frozen: the
* schema applies zod `readonly` at each nested level, and the sorted entry
* array plus result object are frozen explicitly.
* @param value - unvalidated registry content from the durable boundary.
* @returns the immutable parsed registry.
*/
function parsePageAppRegistry(value) {
	const parsed = parseStrict(registrySchema, value, "page-app registry");
	const packageNames = /* @__PURE__ */ new Set();
	const pageIds = /* @__PURE__ */ new Set();
	const rootIds = /* @__PURE__ */ new Set();
	for (const entry of parsed.entries) {
		assertPageAppSourceNoCredentials(entry.source.display);
		if (packageNames.has(entry.packageName)) throw new Error(`page-app registry: duplicate package name ${entry.packageName}`);
		if (pageIds.has(entry.page.id)) throw new Error(`page-app registry: duplicate page id ${entry.page.id}`);
		if (rootIds.has(entry.page.rootEntryId)) throw new Error(`page-app registry: duplicate root entry id ${entry.page.rootEntryId}`);
		packageNames.add(entry.packageName);
		pageIds.add(entry.page.id);
		rootIds.add(entry.page.rootEntryId);
	}
	const entries = [...parsed.entries].sort((a, b) => a.order - b.order || (a.packageName < b.packageName ? -1 : a.packageName > b.packageName ? 1 : 0));
	Object.freeze(entries);
	return Object.freeze({
		...parsed,
		entries
	});
}
/**
* Read and parse the profile registry, returning null when no registry has
* been published yet. A corrupt or unparsable file throws rather than being
* silently rewritten — the manager preserves it and exposes recovery.
* @param profileDir - absolute profile directory.
* @returns the parsed registry, or null when the file is absent.
*/
async function readPageAppRegistry(profileDir) {
	const paths = resolvePageAppProfilePaths(profileDir);
	let raw;
	try {
		raw = await readFile(paths.registry, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return null;
		throw error;
	}
	return parsePageAppRegistry(JSON.parse(raw));
}
/**
* Atomically publish the profile registry with owner-only permissions. The
* complete value is re-validated through the full v1 schema — including
* credential-bearing display rejection and uniqueness — so no invalid or
* secret-bearing registry can reach disk; nothing is written on rejection.
* The caller owns revision incrementing and journaling; this is the single
* write path for the ownership file.
* @param profileDir - absolute profile directory.
* @param registry - the complete next registry value.
*/
async function writePageAppRegistry(profileDir, registry) {
	const validated = parsePageAppRegistry(registry);
	await writeFileAtomic(resolvePageAppProfilePaths(profileDir).registry, `${JSON.stringify(validated, null, 2)}\n`, {
		mode: 384,
		dirMode: 448
	});
}

//#endregion
//#region src/profile/layer.ts
var import_js_yaml = require_js_yaml();
/** A Loader module name that points at a filesystem location, never a bare package specifier. */
const RELATIVE_NAME = /^(\.\.?[\\/]|[\\/]|[A-Za-z]:[\\/]|file:|link:)/;
/** A Loader module name carrying a `scheme:` prefix. */
const SCHEME_NAME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
/**
* The one Loader builtin scheme the managed layer may carry. The Loader
* resolves `cordis:<name>` against its runtime builtins (`cordis:group` in
* the shipped composition); every other scheme names a URL or external
* resolver and is not a built-in or bare package/subpath specifier.
*/
const LOADER_BUILTIN_SCHEME = "cordis";
/**
* A valid bare package/subpath specifier: unscoped or scoped, no empty
* segments, and no `.` or `..` path segment anywhere (every segment may still
* contain dots, so dotted names like `pkg.v2` stay legal).
*/
const BARE_SPECIFIER = /^(?:@(?!\.{1,2}(?:\/|$))[a-zA-Z0-9._~-]+\/)?(?!\.{1,2}(?:\/|$))[a-zA-Z0-9._~-]+(?:\/(?!\.{1,2}(?:\/|$))[a-zA-Z0-9._~-]+)*$/;
/** A valid Loader builtin name after `cordis:`: a single filename-safe token. */
const BUILTIN_NAME = /^[A-Za-z0-9._-]+$/;
/**
* Assert one root's entry tree is declarative and portable: every Loader
* `name` must be a built-in (`cordis:` plus a valid builtin name) or a valid
* bare package/subpath specifier (scoped or unscoped, no empty segments, no
* query/fragment/whitespace), never a relative or absolute filesystem
* location, a URL, or a foreign scheme. Nested group structure is walked
* recursively.
* @param entries - the root's serializable Loader entry tree.
*/
function assertBareLoaderNames(entries) {
	for (const entry of entries) {
		if (entry.name !== void 0) {
			const name = entry.name;
			if (RELATIVE_NAME.test(name)) throw new Error(`page-app layer: relative Loader name ${JSON.stringify(name)} is not serializable`);
			const scheme = SCHEME_NAME.exec(name)?.[0]?.slice(0, -1);
			if (scheme !== void 0) {
				if (scheme !== LOADER_BUILTIN_SCHEME) throw new Error(`page-app layer: Loader name ${JSON.stringify(name)} uses non-builtin scheme ${JSON.stringify(scheme)}`);
				if (!BUILTIN_NAME.test(name.slice(scheme.length + 1))) throw new Error(`page-app layer: Loader name ${JSON.stringify(name)} has an invalid builtin name`);
			} else if (!BARE_SPECIFIER.test(name)) throw new Error(`page-app layer: Loader name ${JSON.stringify(name)} is not a bare package/subpath specifier`);
		}
		if (entry.insert !== void 0) assertBareLoaderNames(entry.insert);
	}
}
/** Stable total order over enabled roots: package name, then root entry id. */
function compareRoots(a, b) {
	return a.packageName < b.packageName ? -1 : a.packageName > b.packageName ? 1 : a.rootEntryId < b.rootEntryId ? -1 : a.rootEntryId > b.rootEntryId ? 1 : 0;
}
/**
* Render the deterministic runtime layer for one profile: one `insert` patch
* per enabled Managed Root. Enabled roots are sorted by package name (then
* root entry id) on a copy, so equivalent input in any caller order yields
* byte-identical YAML, and input objects are only ever read. Key order inside
* every mapping is normalized (`sortKeys`). The rendered document is scanned
* for any `!!js` marker and rejected if found, because the layer is loaded by
* the Loader dialect that would otherwise evaluate it.
* @param entries - every validated Managed Root of the profile.
* @returns the exact runtime-layer YAML document (trailing newline included).
*/
function renderPageAppRuntimeLayer(entries) {
	const enabled = entries.filter((root) => root.enabled).sort(compareRoots);
	for (const root of enabled) assertBareLoaderNames(root.entries);
	const rendered = (0, import_js_yaml.dump)(enabled.map((root) => ({ insert: root.entries })), {
		noRefs: true,
		sortKeys: true
	});
	if (rendered.includes("!!js")) throw new Error("page-app layer: refused to serialize a !!js expression");
	return rendered;
}

//#endregion
//#region src/profile/journal.ts
/**
* Durable transaction journal schema v1 for page-app mutations. Every
* mutation writes a journal plus 0600 private backup files before touching
* owned state; the journal records the shared lock's owner token, the current
* phase (prepared -> staged -> committing), and before-file integrity hashes,
* so startup recovery can complete, restore, or conflict without guessing.
* @module @deepseek-ai/dsh-page-app-profile/journal
*/
const journalFileStateSchema = import_zod.z.discriminatedUnion("present", [import_zod.z.object({ present: import_zod.z.literal(false) }).strict().readonly(), import_zod.z.object({
	present: import_zod.z.literal(true),
	sha256: import_zod.z.string().regex(/^[0-9a-f]{64}$/)
}).strict().readonly()]);
const journalSchema = import_zod.z.object({
	schemaVersion: import_zod.z.literal(1),
	phase: import_zod.z.enum([
		"prepared",
		"staged",
		"committing"
	]),
	lockOwnerToken: import_zod.z.string().regex(PAGE_APP_TOKEN_PATTERN),
	files: import_zod.z.record(import_zod.z.string().min(1), journalFileStateSchema).readonly()
}).strict().readonly();
/**
* Parse and validate journal schema v1. Unknown versions, unknown phases,
* unknown keys, and malformed file states are rejected; v1 fails closed and
* never reads a newer format.
* @param value - unvalidated journal content from the durable boundary.
* @returns the immutable parsed journal.
*/
function parsePageAppJournal(value) {
	return parseStrict(journalSchema, value, "page-app journal");
}
/**
* Resolve one journal-owned relative path and prove it stays inside the
* profile. Paths are manager-directory-relative (for example
* `registry.json`, or `../package.json` for the profile manifest), must not
* be absolute, and after normalization must not escape the profile
* directory — otherwise a crafted name could read or back up arbitrary files
* outside the profile.
* @param profileDir - absolute profile directory.
* @param relative - the caller-supplied manager-relative path.
* @returns the absolute, contained path.
*/
function resolveJournalOwnedPath(profileDir, relative) {
	if (relative === "") throw new Error("page-app journal: empty path is not a manager-relative path");
	if (isAbsolute(relative) || /^[A-Za-z]:[\\/]/.test(relative)) throw new Error(`page-app journal: ${JSON.stringify(relative)} is an absolute path, not a manager-relative path`);
	const managerDirectory = resolve(resolvePageAppProfilePaths(profileDir).directory);
	const containment = resolve(profileDir);
	const resolved = resolve(managerDirectory, relative);
	if (resolved !== containment && !resolved.startsWith(`${containment}${sep}`)) throw new Error(`page-app journal: ${JSON.stringify(relative)} escapes the profile directory`);
	return resolved;
}
/**
* Prove that `resolved` (already lexically contained) does not escape the
* profile through symlinks. The canonical profile root is compared against
* the realpath of the deepest existing ancestor of the target, so a symlinked
* directory or source file pointing outside is rejected before anything is
* read or backed up.
* @param profileDir - absolute profile directory (may itself be a symlink).
* @param resolved - the lexically contained absolute target path.
* @param relative - the caller-supplied path used in diagnostics.
*/
async function ensureRealpathContained(profileDir, resolved, relative) {
	let root;
	try {
		root = await realpath(profileDir);
	} catch {
		root = resolve(profileDir);
	}
	let probe = resolved;
	for (;;) {
		let real;
		try {
			real = await realpath(probe);
		} catch (error) {
			const code = error.code;
			if (code === "ENOENT" || code === "ENOTDIR") {
				const parent = dirname(probe);
				if (parent === probe) throw error;
				probe = parent;
				continue;
			}
			throw error;
		}
		if (real !== root && !real.startsWith(`${root}${sep}`)) throw new Error(`page-app journal: ${JSON.stringify(relative)} resolves outside the profile directory`);
		return;
	}
}
/**
* Snapshot the before-state of owned files under the profile: an sha256 hash
* for every present file plus a 0600 private backup copy, and an absent
* marker for files that do not exist. Backups and hashes are taken before any
* mutation and before the journal itself is written. Paths are
* manager-relative, must stay inside the profile directory lexically, and
* must not escape it through symlinks.
* @param profileDir - absolute profile directory.
* @param relativePaths - manager-relative file paths to snapshot.
* @returns the frozen file-state record for the journal.
*/
async function snapshotPageAppJournalFiles(profileDir, relativePaths) {
	const files = {};
	for (const relative of relativePaths) {
		const absolute = resolveJournalOwnedPath(profileDir, relative);
		await ensureRealpathContained(profileDir, absolute, relative);
		let content;
		try {
			content = await readFile(absolute, "utf8");
		} catch (error) {
			if (error.code === "ENOENT") content = null;
			else throw error;
		}
		if (content === null) {
			files[relative] = Object.freeze({ present: false });
			continue;
		}
		files[relative] = Object.freeze({
			present: true,
			sha256: createHash("sha256").update(content).digest("hex")
		});
		await writeFileAtomic(`${absolute}.backup`, content, {
			mode: 384,
			dirMode: 448
		});
	}
	return Object.freeze(files);
}
/**
* Advance a journal to its next phase. Only the strictly forward transitions
* prepared -> staged -> committing are legal; any other transition throws,
* because recovery interprets the phase order as the durable commit order.
* @param journal - the current journal.
* @param phase - the next phase.
* @returns a new immutable journal at the requested phase.
*/
function advancePageAppJournalPhase(journal, phase) {
	const order = {
		prepared: 0,
		staged: 1,
		committing: 2
	};
	if (order[phase] !== order[journal.phase] + 1) throw new Error(`page-app journal: cannot advance phase ${journal.phase} -> ${phase}`);
	return Object.freeze({
		...journal,
		phase
	});
}
/**
* Validate and atomically write the transaction journal with owner-only
* permissions. Invalid journals are refused before any file is created.
* @param profileDir - absolute profile directory.
* @param journal - the journal value to persist.
*/
async function writePageAppJournal(profileDir, journal) {
	const validated = parsePageAppJournal(journal);
	await writeFileAtomic(resolvePageAppProfilePaths(profileDir).journal, `${JSON.stringify(validated, null, 2)}\n`, {
		mode: 384,
		dirMode: 448
	});
}
/**
* Read and parse the active transaction journal, or null when no journal
* exists. A journal that exists but cannot be parsed throws — recovery must
* fail closed on an unreadable journal.
* @param profileDir - absolute profile directory.
* @returns the parsed journal, or null when the file is absent.
*/
async function readPageAppJournal(profileDir) {
	const paths = resolvePageAppProfilePaths(profileDir);
	let raw;
	try {
		raw = await readFile(paths.journal, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return null;
		throw error;
	}
	return parsePageAppJournal(JSON.parse(raw));
}
/**
* Remove the active transaction journal after a committed operation.
* @param profileDir - absolute profile directory.
*/
async function removePageAppJournal(profileDir) {
	await rm(resolvePageAppProfilePaths(profileDir).journal, { force: true });
}

//#endregion
//#region src/profile/lock.ts
/**
* The shared profile mutation lock. The manager and `dsh plugin` both acquire
* the same `operation.lock` (`wx`-created, 0600, inside the 0700 manager
* directory) before invoking pnpm or mutating owned files, so the two
* mutation paths cannot race. The payload records schema version, owner kind,
* pid, opaque owner token, and acquisition timestamp; startup recovery uses
* the token to distinguish a dead transaction owner from live contention and
* arbitrates exactly one winner through an append-only recovery claim chain.
* @module @deepseek-ai/dsh-page-app-profile/lock
*/
const lockPayloadSchema = import_zod.z.object({
	schemaVersion: import_zod.z.literal(1),
	ownerKind: import_zod.z.enum(["manager", "plugin-cli"]),
	ownerToken: import_zod.z.string().regex(PAGE_APP_TOKEN_PATTERN),
	pid: import_zod.z.number().int().positive(),
	acquiredAt: import_zod.z.string().min(1)
}).strict().readonly();
/** Retry cadence for a contended lock. */
const LOCK_RETRY_INITIAL_MS = 20;
const LOCK_RETRY_MAX_MS = 250;
/**
* How long a contender waits for release. The holder may legitimately run a
* long pnpm operation, so this is sized for pnpm, not file work; recovery of
* a dead owner is an explicit startup step, never an implicit wait shortcut.
*/
const LOCK_WAIT_DEADLINE_MS = 15 * 6e4;
/** Whether an exclusive create found an existing lock. */
async function isLockContention(error, lockPath) {
	const code = error?.code;
	if (code === "EEXIST") return true;
	if (code !== "EPERM") return false;
	try {
		await lstat(lockPath);
		return true;
	} catch {
		return false;
	}
}
/**
* Hold the shared profile mutation lock around one operation. The lock file
* is created with exclusive create (`wx`) and 0600 mode inside a 0700 manager
* directory; contenders back off and wait until the holder releases, so two
* mutations of one profile serialize. A stale lock is never removed here —
* startup recovery is the explicit path for a dead owner.
* @param profileDir - absolute profile directory.
* @param owner - the locking identity; its opaque token is recorded in the payload.
* @param operation - the mutation to run while holding the lock.
* @returns the operation's result; the lock releases on both outcomes.
*/
async function withPageAppProfileLock(profileDir, owner, operation) {
	assertSafeOpaqueToken(owner.token);
	const paths = resolvePageAppProfilePaths(profileDir);
	await mkdir(paths.directory, {
		recursive: true,
		mode: 448
	});
	if (process.platform !== "win32") await chmod(paths.directory, 448);
	const payload = JSON.stringify({
		schemaVersion: 1,
		ownerKind: owner.kind,
		ownerToken: owner.token,
		pid: process.pid,
		acquiredAt: (/* @__PURE__ */ new Date()).toISOString()
	}, null, 2);
	const deadline = Date.now() + LOCK_WAIT_DEADLINE_MS;
	let delay = LOCK_RETRY_INITIAL_MS;
	for (;;) {
		try {
			await writeFile(paths.operationKey, payload, {
				mode: 384,
				flag: "wx"
			});
			break;
		} catch (error) {
			if (!await isLockContention(error, paths.operationKey)) throw error;
		}
		if (Date.now() >= deadline) throw new Error(`page-app lock: timed out waiting for the operation lock at ${paths.operationKey}`);
		await new Promise((resolve) => setTimeout(resolve, delay));
		delay = Math.min(delay * 2, LOCK_RETRY_MAX_MS);
	}
	try {
		return await operation();
	} finally {
		try {
			const current = await readFile(paths.operationKey, "utf8");
			if (parseStrict(lockPayloadSchema, JSON.parse(current), "page-app lock").ownerToken === owner.token) await rm(paths.operationKey, { force: true });
		} catch {}
	}
}

//#endregion
//#region src/host/source.ts
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
//#region src/host/activation.ts
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
//#region src/host/contract.ts
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
//#region src/host/validation.ts
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
//#region src/host/transaction.ts
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
				ownerPackageName: this.deps.managerPackageName ?? this.deps.runtime.ownerPackageName,
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
			expectedRoots: registry === null ? [] : derivePageAppExpectedRoots(this.deps.profileDir, registry, this.deps.managerPackageName ?? this.deps.runtime.ownerPackageName)
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
function derivePageAppExpectedRoots(profileDir, registry, managerPackageName = "@deepseek-ai/dsh-page-app-manager") {
	const profileDependencies = readProfileDependenciesFrom(profileDir);
	const expectedRoots = [];
	for (const entry of registry.entries) {
		if (!entry.enabled) continue;
		const row = composedManagedRow(profileDir, entry, registry, profileDependencies);
		if (row === void 0) continue;
		const wrapper = managedRootWrapperRow({
			ownerPackageName: managerPackageName,
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
//#region src/host/executor.ts
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
		const { execa } = await import("./execa-C8EDvHn3.mjs");
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
//#region src/host/recovery.ts
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
			expectedRoots: registry === null ? [] : derivePageAppExpectedRoots(profileDir, registry, runtime.ownerPackageName)
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
//#region src/host/index.ts
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
var __runInitializers = void 0 && (void 0).__runInitializers || function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = void 0 && (void 0).__esDecorate || function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
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
		hostDescriptor;
		constructor(ctx, options) {
			super(ctx, "pageAppManager");
			this.profileRuntime = options.profileRuntime;
			this.hostDescriptor = Object.freeze({
				...options.hostDescriptor,
				capabilities: Object.freeze([...options.hostDescriptor.capabilities])
			});
			this.lifecycle = new PageAppLifecycle({
				profileDir: this.profileRuntime.identity.directory,
				executor: options.executor ?? createPnpmExecutor(),
				runtime: this.profileRuntime,
				managerPackageName: this.profileRuntime.ownerPackageName,
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
				host: this.hostDescriptor,
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
					ownerPackageName: this.profileRuntime.ownerPackageName,
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
				wrapperResolvable: managerWrapperResolvable(this.profileRuntime.identity.directory, this.profileRuntime.ownerPackageName),
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
const inject = [
	PROFILE_RUNTIME_SERVICE,
	WORKSPACE_HOST_ADAPTER_SERVICE,
	"loader"
];
/** Validated plugin config: the Host settlement-wait cap (defaults in the schema). */
const Config = import_zod.z.object({ settlementTimeoutMs: import_zod.z.number().int().positive().default(6e4) });
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
	const hostDescriptor = ctx.get(WORKSPACE_HOST_ADAPTER_SERVICE);
	if (hostDescriptor === void 0) throw new Error("page-app-manager: no verified DSH Host Adapter is active");
	ctx.provide(WORKBENCH_RUNTIME_SERVICE$1, createWorkbenchRuntime(ctx));
	const manager = new PageAppManager(ctx, {
		profileRuntime: runtime,
		hostDescriptor,
		config: { settlementTimeoutMs: config.settlementTimeoutMs ?? 6e4 }
	});
	ctx.effect(() => () => {
		manager.dispose();
	}, "page-app-manager: abort in-flight transactions when the manager fiber unloads");
}

//#endregion
export { Config, PageAppActivationGate, PageAppBuildPermissionError, PageAppCommandAbortedError, PageAppLifecycle, PageAppManager, RECOVERY_OWNED_FILES, WORKBENCH_RUNTIME_SERVICE, apply, createPnpmExecutor, createWorkbenchRuntime, derivePageAppExpectedRoots, inject, name, parsePageAppInstallSource, recoverPageAppTransaction, resolveInstalledPackageDir, validateInstalledPageAppPackage };