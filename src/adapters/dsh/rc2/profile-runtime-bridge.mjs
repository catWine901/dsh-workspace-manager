import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { z } from "zod";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { Service, symbols } from "@deepseek-ai/cordis";
import { applyEntryPatches, entryListSchema } from "@deepseek-ai/cordis-plugin-include";
import { dump, load } from "js-yaml";
//#region ../../boot/page-app-profile/src/paths.ts
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
//#region ../../boot/page-app-profile/src/manifest.ts
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
const workspaceSchema = z.object({
	schemaVersion: z.literal(1),
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().min(1),
	defaultOrder: z.number().int(),
	rootEntryId: z.string().min(1)
}).strict().readonly();
const packageManifestSchema = z.object({ dsh: z.object({ workspace: workspaceSchema }) });
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
//#region ../../util/atomic-write/src/index.ts
/**
* Zero-dependency atomic file replacement and writer coordination.
* `writeFileAtomic` writes a random-suffix sibling with exclusive create and
* the caller's permission bits, then renames it over the target, so readers
* observe either the old or the new complete content and a replaced file ends
* up with exactly the stated mode. `withFileLock` serializes cross-process
* writers of one file through a `wx`-created `<file>.lock` sibling, so a
* read-modify-write cycle can never resurrect a state another writer just
* replaced; readers stay lock-free because the rename commit is atomic.
* @module @deepseek-ai/dsh-atomic-write
*/
/**
* Replace `filename` with `content` in one atomic step, creating parent
* directories. The content is first written to a random-suffix sibling opened
* with exclusive create (`wx`): the open refuses to follow a symlink planted
* at the temp path, and the fresh inode carries `options.mode` through the
* rename, so replacing a wider-permission file narrows it without a chmod
* race. The rename also replaces a symlinked target itself instead of writing
* through to its referent, and the same-directory sibling keeps the rename on
* one filesystem. On any failure the temp file is removed and the failure
* rethrown. Crash durability (fsync) is out of scope.
* @param filename - final path receiving the content.
* @param content - complete next file content.
* @param options - permission bits for the replacement inode.
*/
async function writeFileAtomic(filename, content, options) {
	await mkdir(dirname(filename), {
		recursive: true,
		...options.dirMode === void 0 ? {} : { mode: options.dirMode }
	});
	const temp = `${filename}.${randomBytes(6).toString("hex")}.tmp`;
	try {
		await writeFile(temp, content, {
			mode: options.mode,
			flag: "wx"
		});
		await rename(temp, filename);
	} catch (error) {
		await rm(temp, { force: true });
		throw error;
	}
}
//#endregion
//#region ../../boot/page-app-profile/src/registry.ts
/**
* Page-app registry schema v1: strict parsing, uniqueness, stable ordering,
* and deeply immutable results, plus atomic registry file IO. The registry is
* the sole ownership authority; every other projection is derived from it.
* @module @deepseek-ai/dsh-page-app-profile/registry
*/
const registrySourceSchema = z.object({
	kind: z.enum([
		"registry",
		"file",
		"link",
		"tarball",
		"git"
	]),
	display: z.string().min(1)
}).strict().readonly();
const pageFieldsSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().min(1),
	defaultOrder: z.number().int(),
	rootEntryId: z.string().min(1)
}).strict().readonly();
const registryEntrySchema = z.object({
	packageName: z.string().min(1),
	source: registrySourceSchema,
	resolvedVersion: z.string().min(1),
	page: pageFieldsSchema,
	order: z.number().int(),
	enabled: z.boolean(),
	hidden: z.boolean(),
	installedAt: z.string().min(1),
	updatedAt: z.string().min(1)
}).strict().readonly();
const registrySchema = z.object({
	schemaVersion: z.literal(1),
	revision: z.number().int().nonnegative(),
	entries: z.array(registryEntrySchema).readonly()
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
//#region ../../boot/page-app-profile/src/layer.ts
/**
* Deterministic runtime-layer serialization for validated Managed Roots. The
* layer is a derived, never-authoritative file: it contains only enabled
* roots as `insert` patches, is byte-identical for equivalent input, and
* refuses to carry `!!js` expressions or relative Loader module names.
* @module @deepseek-ai/dsh-page-app-profile/layer
*/
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
	const rendered = dump(enabled.map((root) => ({ insert: root.entries })), {
		noRefs: true,
		sortKeys: true
	});
	if (rendered.includes("!!js")) throw new Error("page-app layer: refused to serialize a !!js expression");
	return rendered;
}
//#endregion
//#region ../../boot/page-app-profile/src/journal.ts
/**
* Durable transaction journal schema v1 for page-app mutations. Every
* mutation writes a journal plus 0600 private backup files before touching
* owned state; the journal records the shared lock's owner token, the current
* phase (prepared -> staged -> committing), and before-file integrity hashes,
* so startup recovery can complete, restore, or conflict without guessing.
* @module @deepseek-ai/dsh-page-app-profile/journal
*/
const journalFileStateSchema = z.discriminatedUnion("present", [z.object({ present: z.literal(false) }).strict().readonly(), z.object({
	present: z.literal(true),
	sha256: z.string().regex(/^[0-9a-f]{64}$/)
}).strict().readonly()]);
const journalSchema = z.object({
	schemaVersion: z.literal(1),
	phase: z.enum([
		"prepared",
		"staged",
		"committing"
	]),
	lockOwnerToken: z.string().regex(PAGE_APP_TOKEN_PATTERN),
	files: z.record(z.string().min(1), journalFileStateSchema).readonly()
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
//#region ../../boot/page-app-profile/src/lock.ts
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
const lockPayloadSchema = z.object({
	schemaVersion: z.literal(1),
	ownerKind: z.enum(["manager", "plugin-cli"]),
	ownerToken: z.string().regex(PAGE_APP_TOKEN_PATTERN),
	pid: z.number().int().positive(),
	acquiredAt: z.string().min(1)
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
/**
* Maximum recovery-claim generations per owner token. Each generation is one
* recovery attempt, so a longer chain means a crash-takeover loop; beyond the
* cap recovery fails closed for operator repair.
*/
const RECOVERY_CLAIM_MAX_GENERATIONS = 64;
/** Zero-padded width of the generation segment in a claim file name. */
const RECOVERY_CLAIM_INDEX_WIDTH = 4;
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
/**
* Classify a pid's liveness: `true` when the process exists, `false` when it
* deterministically does not, and `'indeterminate'` when the probe answer is
* neither. Indeterminate liveness never authorizes lock removal.
* @param pid - the pid recorded in a lock payload.
* @returns the liveness classification.
*/
function processLiveness(pid) {
	if (!Number.isInteger(pid) || pid <= 0) return "indeterminate";
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		const code = error.code;
		if (code === "ESRCH") return false;
		if (code === "EPERM") return true;
		return "indeterminate";
	}
}
/**
* Read the recoverer pid recorded in a recovery claim file, or undefined when
* the claim is absent or unreadable. An unreadable claim fails closed in the
* caller, never authorizing a takeover.
* @param claimFile - the claim file path.
* @returns the claimant pid, or undefined when absent or invalid.
*/
async function readClaimantPid(claimFile) {
	try {
		const raw = await readFile(claimFile, "utf8");
		const pid = Number(raw.trim());
		return Number.isInteger(pid) && pid > 0 ? pid : void 0;
	} catch {
		return;
	}
}
/**
* Read a claim's recoverer pid, failing closed when the claim is unreadable or
* does not contain a legal pid. A half-written claim (created but not yet
* filled by a concurrent recoverer) therefore rejects instead of authorizing
* a takeover.
* @param claimFile - the claim file path.
* @returns the claimant pid.
*/
async function readRequiredClaimantPid(claimFile) {
	const pid = await readClaimantPid(claimFile);
	if (pid === void 0) throw new Error(`page-app lock: recovery claim is unreadable at ${claimFile}; operator repair required`);
	return pid;
}
/**
* Scan and validate the complete recovery claim chain for one token: the
* legacy fixed-path claim `<operationKey>.<token>.claim` (generation 0 when
* present) plus every `<operationKey>.<token>.claim.<NNNN>` generation. The
* scan fails closed on any anomaly — a claim-like file whose suffix is not
* exactly four digits, a generation index at or beyond the cap, a legacy
* claim coexisting with generation 0000, a gap or missing start in the
* generation sequence, or an unreadable/malformed claim — because claims are
* immutable evidence that a confused or tampered chain must never be
* auto-repaired around. The empty chain (no claims) is valid.
*
* On Windows the filesystem matches names case-insensitively while the scan
* compares them case-sensitively, so a claim written with a different case
* would be invisible to the exact match yet still conflict with an exclusive
* create of the canonical name. The scan therefore also rejects any
* case-aliased claim name (a name that differs from a canonical claim only by
* case) on win32: the alias and its canonical form are the same file there,
* and the canonical-exact chain semantics cannot be preserved around it.
* @param directory - the manager directory holding the claims.
* @param operationKeyBasename - `basename(operationKey)`, the claim prefix root.
* @param token - the validated owner token naming the claim chain.
* @returns the validated chain in generation order (index equals position).
*/
async function scanRecoveryClaimChain(directory, operationKeyBasename, token) {
	const legacyName = `${operationKeyBasename}.${token}.claim`;
	const generationPrefix = `${legacyName}.`;
	let names;
	try {
		names = await readdir(directory);
	} catch (error) {
		if (error.code === "ENOENT") return { claims: [] };
		throw error;
	}
	let legacyPath;
	const generations = /* @__PURE__ */ new Map();
	for (const name of names) {
		if (name === legacyName) {
			legacyPath = join(directory, name);
			continue;
		}
		if (!name.startsWith(generationPrefix)) continue;
		const suffix = name.slice(generationPrefix.length);
		if (suffix.length !== RECOVERY_CLAIM_INDEX_WIDTH || !/^\d{4}$/.test(suffix)) throw new Error(`page-app lock: unexpected claim-like file at ${join(directory, name)}; operator repair required`);
		const index = Number(suffix);
		if (index >= RECOVERY_CLAIM_MAX_GENERATIONS) throw new Error(`page-app lock: recovery claim generation out of range at ${join(directory, name)}; operator repair required`);
		generations.set(index, join(directory, name));
	}
	if (process.platform === "win32") {
		const legacyLower = legacyName.toLowerCase();
		const generationPrefixLower = generationPrefix.toLowerCase();
		for (const name of names) {
			if (name === legacyName || name.startsWith(generationPrefix)) continue;
			const lower = name.toLowerCase();
			if (lower === legacyLower) throw new Error(`page-app lock: case-aliased legacy recovery claim at ${join(directory, name)}; operator repair required`);
			if (!lower.startsWith(generationPrefixLower)) continue;
			const suffix = lower.slice(generationPrefixLower.length);
			if (suffix.length === RECOVERY_CLAIM_INDEX_WIDTH && /^\d{4}$/.test(suffix) && Number(suffix) < RECOVERY_CLAIM_MAX_GENERATIONS) throw new Error(`page-app lock: case-aliased recovery claim at ${join(directory, name)}; operator repair required`);
		}
	}
	if (legacyPath !== void 0 && generations.has(0)) throw new Error(`page-app lock: ambiguous legacy claim at ${legacyPath} alongside chain generation 0000; operator repair required`);
	const claims = [];
	let expected = 0;
	if (legacyPath !== void 0) {
		claims.push({
			index: 0,
			path: legacyPath,
			pid: await readRequiredClaimantPid(legacyPath)
		});
		expected = 1;
	}
	for (const [index, path] of [...generations.entries()].sort((a, b) => a[0] - b[0])) {
		if (index !== expected) throw new Error(`page-app lock: recovery claim chain is discontinuous at ${path}; operator repair required`);
		claims.push({
			index,
			path,
			pid: await readRequiredClaimantPid(path)
		});
		expected += 1;
	}
	return { claims };
}
/**
* Atomically win the recovery claim for `token` — the single-winner gate of
* the whole recovery path. Claims form an append-only successor chain
* (`<operationKey>.<token>.claim.<generation>`; the pre-chain fixed-path
* claim `<operationKey>.<token>.claim` counts as generation 0): a claim is
* created with exclusive `wx` and never deleted, moved, or replaced, so the
* chain only grows and each generation path is claimed by at most one
* recoverer on every platform. Every scan validates the whole chain before
* acting: generations must be contiguous from 0 and every claim readable (a
* gap, a legacy/0000 coexistence, a malformed claim-like name, an
* out-of-range index, or an unreadable claim fails closed), every ancestor
* must be provably dead, and the tail must be provably dead for a recoverer
* to create the next generation — so a dead high generation can never mask a
* live ancestor. The `wx` create is the only atomic primitive; a recoverer
* whose create fails EEXIST re-scans and observes the winner's live tail,
* failing closed, and an exhausted chain (at the generation cap) fails closed
* for operator repair. Because a successor can only be created over a
* provably dead tail of a validated chain, at most one live recoverer ever
* holds the winning claim, in the same process or across processes.
* @param operationKey - the lock file path naming the claim chain.
* @param token - the validated owner token naming the claim chain.
*/
async function acquireRecoveryClaim(operationKey, token) {
	const directory = dirname(operationKey);
	const prefix = `${basename(operationKey)}.${token}.claim.`;
	let previousFingerprint;
	for (;;) {
		const chain = await scanRecoveryClaimChain(directory, basename(operationKey), token);
		const fingerprint = chain.claims.map((claim) => `${claim.index}:${claim.path}:${claim.pid}`).join("|");
		const tail = chain.claims.length === 0 ? void 0 : chain.claims[chain.claims.length - 1];
		let tailIndex = -1;
		if (tail !== void 0) {
			tailIndex = tail.index;
			for (const ancestor of chain.claims.slice(0, -1)) {
				const liveness = processLiveness(ancestor.pid);
				if (liveness === false) continue;
				if (liveness === true) throw new Error(`page-app lock: recovery claim ancestor is still alive at ${ancestor.path}; operator repair required`);
				throw new Error(`page-app lock: cannot determine liveness of recovery claim ancestor at ${ancestor.path}`);
			}
			const liveness = processLiveness(tail.pid);
			if (liveness === true) throw new Error("page-app lock: recovery was already claimed by another recoverer");
			if (liveness === "indeterminate") throw new Error(`page-app lock: cannot determine liveness of recovery claimant at ${tail.path}`);
		}
		const next = tailIndex + 1;
		if (next >= RECOVERY_CLAIM_MAX_GENERATIONS) throw new Error("page-app lock: recovery claim chain is exhausted; operator repair required");
		const nextPath = join(directory, `${prefix}${String(next).padStart(RECOVERY_CLAIM_INDEX_WIDTH, "0")}`);
		try {
			await writeFile(nextPath, `${process.pid}\n`, {
				mode: 384,
				flag: "wx"
			});
			return;
		} catch (error) {
			if (error.code !== "EEXIST") throw error;
			if (previousFingerprint === fingerprint) throw new Error("page-app lock: recovery claim create failed EEXIST with an unchanged scan; operator repair required");
			previousFingerprint = fingerprint;
		}
	}
}
/**
* Atomically quarantine a dead lock under a token-specific name. Only the
* claim winner from {@link acquireRecoveryClaim} — the sole recoverer allowed
* past the chain gate — moves the lock to `<operationKey>.<token>.quarantine`.
* On a rename failure the claim is retained and the error propagates:
* recovery fails closed for operator repair, because claims are never deleted.
* @param operationKey - the lock file path.
* @param token - the validated owner token naming the quarantine.
*/
async function quarantineLock(operationKey, token) {
	await acquireRecoveryClaim(operationKey, token);
	await rename(operationKey, `${operationKey}.${token}.quarantine`);
}
/**
* Startup recovery for an orphaned operation lock. A dead `manager` lock
* whose token matches the active journal is quarantined under a token-specific
* name by exactly one recoverer — the winner of the exclusive recovery claim
* chain; a simultaneous loser fails rather than proceeding. When the lock is
* already gone but the journal survives, recovery is still owed and the same
* claim chain is advanced: the whole chain is validated first (contiguous
* generations from 0, readable claims, provably dead ancestors — the legacy
* fixed-path claim counts as generation 0 and coexisting with `.0000` is
* ambiguous), then a provably dead tail is superseded by the next generation,
* while a live, indeterminate, or unreadable tail fails closed, so exactly
* one caller proceeds to the fresh `wx` acquisition and runs recovery in
* every crash state. A dead `manager` lock without a journal is safe to
* remove because the transaction protocol forbids all mutations before
* journal publication and removes the journal only after commit. Every other
* case fails closed for operator repair: a live pid, a mismatched token, an
* unreadable payload, indeterminate liveness, or any dead `plugin-cli` lock
* (generic pnpm may have stopped mid-mutation, and token-correlated
* quarantine recovery is manager-only). The caller must win a fresh exclusive
* lock acquisition before running recovery.
* @param profileDir - absolute profile directory.
*/
async function recoverOrphanedPageAppLock(profileDir) {
	const paths = resolvePageAppProfilePaths(profileDir);
	let raw;
	try {
		raw = await readFile(paths.operationKey, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") {
			const journal = await readPageAppJournal(profileDir);
			if (journal !== null) await acquireRecoveryClaim(paths.operationKey, journal.lockOwnerToken);
			return;
		}
		throw error;
	}
	let payload;
	try {
		payload = parseStrict(lockPayloadSchema, JSON.parse(raw), "page-app lock");
	} catch (error) {
		throw new Error(`page-app lock: unreadable payload at ${paths.operationKey}; operator repair required: ${String(error)}`);
	}
	const liveness = processLiveness(payload.pid);
	if (liveness === true) throw new Error(`page-app lock: owner process ${payload.pid} is still alive at ${paths.operationKey}`);
	if (liveness === "indeterminate") throw new Error(`page-app lock: cannot determine liveness of pid ${payload.pid} at ${paths.operationKey}`);
	const journal = await readPageAppJournal(profileDir);
	if (journal !== null) {
		if (payload.ownerKind === "plugin-cli") throw new Error("page-app lock: dead plugin-cli lock with a journal; operator repair required (token-correlated recovery is manager-only)");
		if (journal.lockOwnerToken !== payload.ownerToken) throw new Error("page-app lock: journal owner token does not match the lock; operator repair required");
		await quarantineLock(paths.operationKey, payload.ownerToken);
		return;
	}
	if (payload.ownerKind === "plugin-cli") throw new Error("page-app lock: dead plugin-cli lock without a journal; operator repair required (pnpm may have stopped mid-mutation)");
	await rm(paths.operationKey, { force: true });
}
//#endregion
//#region ../../boot/app-boot/src/patches.ts
/** Loader patch parsing shared by app boot and the standalone profile-runtime bundle. */
function parsePatchList(binName, file, content, label) {
	let parsed;
	try {
		parsed = load(content, { schema: entryListSchema });
	} catch (error) {
		throw new Error(`${binName}: failed to parse ${label} ${file}: ${String(error)}`);
	}
	if (!Array.isArray(parsed)) throw new Error(`${binName}: ${label} ${file} must be a top-level YAML array of loader patch entries`);
	parsed.forEach((entry, index) => {
		if (typeof entry !== "object" || entry === null || Array.isArray(entry)) throw new Error(`${binName}: ${label} entry ${index + 1} in ${file} must be a mapping (a loader patch entry)`);
	});
	return parsed;
}
/** Load an optional top-level Loader patch list. */
function loadOptionalPatches(binName, file) {
	let content;
	try {
		content = readFileSync(file, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") return void 0;
		throw new Error(`${binName}: failed to read patches ${file}: ${String(error)}`);
	}
	return parsePatchList(binName, file, content, "patches");
}
/** Load a required top-level Loader patch list. */
function loadOverlayPatches(binName, file) {
	let content;
	try {
		content = readFileSync(file, "utf8");
	} catch (error) {
		throw new Error(`${binName}: failed to read overlay ${file}: ${String(error)}`);
	}
	return parsePatchList(binName, file, content, "overlay");
}
//#endregion
//#region ../../boot/app-boot/src/profile-runtime.ts
/**
* Launcher-owned profile runtime: immutable active-profile identity plus the
* sole acknowledged live-recomposition API. `profile-boot` provides one
* `ProfileRuntime` in `boot(..., prepare)` beside the launch-environment and
* cmdline facts, before any config-tree entry mounts; `boot()` binds the root
* Include entry to it immediately after `mountRootInclude` resolves. The
* tree's manager plugin may inject the service during boot but cannot mutate
* the profile until the initial tree has settled — a settled mark that opens
* the mutation gate only after launcher watcher setup fully succeeds, and
* that treats a tree exiting mid-setup as the exit it is (never a boot
* failure, never a settled partial setup). Watcher setup is transactional:
* everything it creates is reverse-disposed on any incomplete outcome, so no
* half-initialized runtime can outlive a failed setup. Every generation — the
* manager's apply/restore and both user-patch watchers — runs through one
* serialized recomposition queue, so no independent `entry.update` writers
* can race on the root Include.
* @module @deepseek-ai/dsh-app-boot/profile-runtime
*/
const FIBER_ACTIVE = 2;
/** The service name the launcher provides `ProfileRuntime` under. */
const PROFILE_RUNTIME_SERVICE = "profileRuntime";
/** The manager package that owns the Feature Runtime Wrapper module. */
const PAGE_APP_MANAGER_PACKAGE_NAME = "@deepseek-ai/dsh-page-app-manager";
/** The service the manager provides under, and every wrapper fiber injects. */
const WORKBENCH_RUNTIME_SERVICE = "workbenchRuntime";
/** Deterministic prefix of one Feature Runtime Wrapper row id (`page-app.wrapper.<pageId>`). */
const PAGE_APP_WRAPPER_ID_PREFIX = "page-app.wrapper.";
/**
* The deterministic wrapper row id of one managed page. The runtime layer and
* the manager's facts/health lookup both derive the same id, so a staged
* wrapper row and its loaded Loader entry are found by the same key.
* @param pageId - the managed page id.
* @returns `page-app.wrapper.<pageId>`.
*/
function managedRootWrapperId(pageId) {
	return `${PAGE_APP_WRAPPER_ID_PREFIX}${pageId}`;
}
/**
* Whether the manager package that owns the Feature Runtime Wrapper module is
* resolvable from the profile. The manager may be profile-local, or supplied
* by the launcher's controlled `$DSH_HOME/profiles/node_modules` fallback;
* no higher ancestor is accepted, so an ambient parent store cannot satisfy
* the wrapper dependency.
* @param profileDir - absolute profile directory.
* @returns true when the manager package.json exists in the profile's own
* node_modules or its controlled `profiles` fallback.
*/
function managerWrapperResolvable(profileDir, ownerPackageName = PAGE_APP_MANAGER_PACKAGE_NAME) {
	if (existsSync(join(profileDir, "node_modules", ownerPackageName, "package.json"))) return true;
	const profilesDir = dirname(profileDir);
	return basename(profilesDir) === "profiles" && existsSync(join(profilesDir, "node_modules", ownerPackageName, "package.json"));
}
/**
* Derive the Feature Runtime Wrapper parent row of one statically valid root:
* a named loader entry for the manager's wrapper module that injects the
* `workbenchRuntime` service, carries the feature's package/page/root identity
* in its config, and mounts the feature's composed rows as its `insert`
* children. Every enabled root of the runtime layer takes this wrapper form,
* so the manager's loader row lookup and hash expectation follow the same
* shape.
* @param input - the feature's package/page identity, contract version, and
* composed feature rows.
* @returns the wrapper parent row (a {@link PageAppRuntimeEntry}).
*/
function managedRootWrapperRow(input) {
	return {
		id: managedRootWrapperId(input.pageId),
		name: `${input.ownerPackageName ?? "@deepseek-ai/dsh-page-app-manager"}/wrapper`,
		inject: [WORKBENCH_RUNTIME_SERVICE],
		config: {
			packageName: input.packageName,
			pageId: input.pageId,
			rootEntryId: input.rootEntryId,
			contractVersion: input.contractVersion
		},
		insert: [...input.entries]
	};
}
/**
* Compose one full generation patch list in precedence order: bundles →
* manager runtime layer → profile patch → home patch → overlays/telemetry.
* The result is a fresh structured clone so the Include's by-reference insert
* rows can never bake an earlier generation's values into a later one.
* @param inputs - the layer inputs in precedence order.
* @returns a fresh patch list for one generation.
*/
function composeProfilePatches(inputs) {
	return structuredClone([
		...inputs.bundlePatches,
		...inputs.managerPatches,
		...inputs.profilePatches,
		...inputs.homePatches,
		...inputs.overlays
	]);
}
/**
* Stable SHA-256 over the canonical YAML rendering of one Loader entry row.
* Key order is normalized (`sortKeys`), so the manager's derived row and the
* Loader's effective options of the same content hash identically; any user
* patch that changes config, name, or disabled changes the hash, which is how
* the runtime reports an external override by root id.
* @param row - the entry row to hash.
* @returns the hex SHA-256 digest of the canonical rendering.
*/
function canonicalManagedRootHash(row) {
	const rendered = dump([{ insert: [row] }], {
		noRefs: true,
		sortKeys: true
	});
	return createHash("sha256").update(rendered).digest("hex");
}
/**
* Parse one staged runtime-layer document (a top-level YAML array of loader
* patch entries in the include dialect) into patches. This is the ONLY way an
* apply/restore turns its request content into the manager layer of a
* generation: the runtime never re-reads the layer file for composition.
* @param content - the exact `runtimeLayer` of the apply request.
* @returns the parsed patch list.
*/
function parseLayerDocument(content) {
	let parsed;
	try {
		parsed = load(content, { schema: entryListSchema });
	} catch (error) {
		throw new Error(`page-app profile runtime: failed to parse the staged runtime layer: ${String(error)}`);
	}
	if (!Array.isArray(parsed)) throw new Error("page-app profile runtime: staged runtime layer must be a top-level YAML array of loader patch entries");
	return parsed;
}
/**
* Read the current manager runtime layer of one profile as loader patches. A
* missing layer means "no manager layer" and yields an empty list; an
* unparsable or non-array file throws — at generation time a corrupt layer
* fails loud instead of silently dropping the managed roots.
* @param binName - the diagnostic prefix on thrown errors.
* @param profileDir - absolute profile directory.
* @returns the layer's patch list (empty when the file is absent).
*/
function readManagerLayerPatches(binName, profileDir) {
	return loadOptionalPatches(binName, resolvePageAppProfilePaths(profileDir).runtimeLayer) ?? [];
}
/**
* Derive the safe runtime layer of one profile from its registry. The
* registry is the ownership authority; this function never writes it. Each
* enabled root is verified against the installed package before it is
* included: a missing dependency or an installed version that differs from
* the committed `resolvedVersion` omits the root (never auto-reinstalling or
* running changed code), and an unreadable manifest, missing bundle patch,
* absent root row, or unserializable entry tree omits it as invalid. A
* corrupt registry yields `recoveryError` with an empty layer and omitted
* list; a null registry (no manager data) is not an error.
* @param binName - the diagnostic prefix on parse errors.
* @param profileDir - absolute profile directory.
* @returns the derived layer and its omission report.
*/
async function deriveSafeRuntimeLayer(binName, profileDir, ownerPackageName = PAGE_APP_MANAGER_PACKAGE_NAME) {
	let registry;
	try {
		registry = await readPageAppRegistry(profileDir);
	} catch (error) {
		return {
			registry: null,
			layer: "",
			omitted: [],
			recoveryError: `page-app registry is corrupt; managed roots failed closed and will not be mounted: ${String(error)}`
		};
	}
	if (registry === null) return {
		registry: null,
		layer: "",
		omitted: []
	};
	const roots = [];
	const omitted = [];
	for (const entry of registry.entries) {
		if (!entry.enabled) continue;
		const derived = deriveRoot(binName, profileDir, entry, ownerPackageName);
		if ("reason" in derived) {
			omitted.push({
				rootEntryId: entry.page.rootEntryId,
				reason: derived.reason
			});
			continue;
		}
		try {
			renderPageAppRuntimeLayer([derived.root]);
		} catch {
			omitted.push({
				rootEntryId: entry.page.rootEntryId,
				reason: "invalid-manifest"
			});
			continue;
		}
		roots.push(derived.root);
	}
	const layer = roots.length > 0 ? renderPageAppRuntimeLayer(roots) : "[]\n";
	return {
		registry,
		layer,
		omitted
	};
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
async function prepareManagerRuntimeLayer(binName, profileDir, ownerPackageName = PAGE_APP_MANAGER_PACKAGE_NAME) {
	const paths = resolvePageAppProfilePaths(profileDir);
	await recoverOrphanedPageAppLock(profileDir);
	return withPageAppProfileLock(profileDir, {
		kind: "manager",
		token: randomUUID()
	}, async () => {
		const derived = await deriveSafeRuntimeLayer(binName, profileDir, ownerPackageName);
		if (derived.recoveryError !== void 0) {
			await rm(paths.runtimeLayer, { force: true });
			return {
				recoveryError: derived.recoveryError,
				omitted: []
			};
		}
		if (derived.registry === null) {
			await rm(paths.runtimeLayer, { force: true });
			return { omitted: [] };
		}
		const current = await readPageAppRegistry(profileDir);
		if (current === null || current.revision !== derived.registry.revision || JSON.stringify(current) !== JSON.stringify(derived.registry)) throw new Error("page-app profile runtime: registry changed during manager-layer preparation; aborting regeneration");
		let existing;
		try {
			existing = readFileSync(paths.runtimeLayer, "utf8");
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		if (existing !== derived.layer) await writeFileAtomic(paths.runtimeLayer, derived.layer, {
			mode: 384,
			dirMode: 448
		});
		return { omitted: derived.omitted };
	});
}
/**
* Probe the installed location of one registry package from the profile's own
* node_modules walk. Manager packages are profile-local pnpm installs, so the
* profile anchor finds them before any parent fallback.
* @param profileDir - absolute profile directory.
* @param packageName - the registry row's package name.
* @returns the installed package directory, or undefined when not installed.
*/
function resolveInstalledPackageDir(profileDir, packageName) {
	for (const searchPath of createRequire(join(profileDir, "package.json")).resolve.paths(packageName) ?? []) {
		const candidate = join(searchPath, packageName);
		if (existsSync(join(candidate, "package.json"))) return candidate;
	}
}
/**
* Derive one validated Managed Root from a registry row and its installed
* package, or the reason the root is unsafe. The installed package must
* exist, carry the committed version, declare a valid `dsh.workspace` v1
* manifest and a resolvable `dsh.bundle.patch`, and the composed bundle
* layer must contain the manifest's root row. The Feature Runtime Wrapper
* module must resolve from the profile: the manager package that owns it has
* to be installed, otherwise the root is omitted as `missing-manager` so a
* boot after a manager uninstall survives with zero managed roots while the
* registry stays owned. Every derived root is emitted in the wrapper parent
* form (the feature rows become the wrapper's `insert` children).
* @param binName - the diagnostic prefix on parse errors.
* @param profileDir - absolute profile directory.
* @param entry - the enabled registry row.
* @returns the validated wrapper root, or the omission reason.
*/
function deriveRoot(binName, profileDir, entry, ownerPackageName) {
	const packageDir = resolveInstalledPackageDir(profileDir, entry.packageName);
	if (packageDir === void 0) return { reason: "missing-dependency" };
	let installed;
	try {
		installed = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
	} catch {
		return { reason: "invalid-manifest" };
	}
	if (installed.version !== entry.resolvedVersion) return { reason: "version-drift" };
	let manifest;
	try {
		manifest = parsePageAppManifest(entry.packageName, installed);
	} catch {
		return { reason: "invalid-manifest" };
	}
	if (!managerWrapperResolvable(profileDir, ownerPackageName)) return { reason: "missing-manager" };
	const bundle = installed.dsh?.bundle;
	if (typeof bundle?.patch !== "string" || bundle.patch === "") return { reason: "invalid-manifest" };
	let patches;
	try {
		patches = loadOverlayPatches(binName, join(packageDir, bundle.patch));
	} catch {
		return { reason: "invalid-manifest" };
	}
	const rootRow = applyEntryPatches([], structuredClone(patches), () => {}).find((row) => row.id === entry.page.rootEntryId);
	if (rootRow === void 0) return { reason: "invalid-manifest" };
	const wrapper = managedRootWrapperRow({
		ownerPackageName,
		packageName: entry.packageName,
		pageId: entry.page.id,
		rootEntryId: entry.page.rootEntryId,
		contractVersion: manifest.schemaVersion,
		entries: [rootRow]
	});
	return { root: {
		packageName: entry.packageName,
		pageId: entry.page.id,
		rootEntryId: wrapper.id,
		enabled: entry.enabled,
		entries: [wrapper]
	} };
}
/**
* Every piece of state the runtime owns, including the immutable identity and
* all launcher-controlled mutable state (acknowledged snapshot, binding,
* settled flag, generation, queue). A `ProfileRuntimeState` lives only in the
* module-private {@link states} WeakMap keyed by the raw service instance:
* the injected service carries no own enumerable or writable properties, so a
* consumer holding the Cordis traceable proxy can enumerate or overwrite
* nothing that affects identity or launcher state.
*/
var ProfileRuntimeState = class {
	ctx;
	identity;
	ownerPackageName;
	recoveryError;
	omittedRoots;
	compose;
	/** Launcher-owned user-patch files watched through the serialized queue. */
	watchPatches;
	/** The launcher/boot-only control, built once over this state's closures. */
	control;
	/** The last acknowledged manager-layer patches; promoted only after an audit passes. */
	managerPatches;
	entry;
	settled = false;
	snapshotInitialized = false;
	generation = 0;
	queue = Promise.resolve();
	constructor(ctx, options) {
		this.ctx = ctx;
		this.identity = Object.freeze({ ...options.identity });
		this.ownerPackageName = options.ownerPackageName ?? "@deepseek-ai/dsh-page-app-manager";
		this.recoveryError = options.recoveryError;
		this.omittedRoots = Object.freeze([...options.omittedRoots ?? []]);
		this.compose = options.compose;
		this.managerPatches = [...options.initialManagerPatches];
		this.watchPatches = Object.freeze([...options.watchPatches ?? []].map((watch) => Object.freeze({ ...watch })));
		this.control = {
			bindRootInclude: (entry) => {
				this.entry = entry;
			},
			initializeManagerSnapshot: (snapshot) => {
				if (this.settled || this.snapshotInitialized || this.generation !== 0) throw new Error("page-app profile runtime: initial manager snapshot can be installed only once before settlement");
				const managerPatches = structuredClone([...snapshot.managerPatches]);
				const omittedRoots = Object.freeze(structuredClone([...snapshot.omittedRoots]));
				this.managerPatches = managerPatches;
				this.recoveryError = snapshot.recoveryError;
				this.omittedRoots = omittedRoots;
				this.snapshotInitialized = true;
			},
			markSettled: async () => {
				this.settled = await this.registerWatchPatches();
			},
			recompose: () => this.recomposeInternal()
		};
	}
	/**
	* Whether the booted tree is already exiting or gone (the app left exactly
	* as asked): the Loader service has been unregistered and/or the root fiber
	* is no longer active. A setup error that lands on such a tree describes the
	* exit, not a watch failure.
	* @returns true when the tree is disposing or disposed.
	*/
	treeExited() {
		return this.ctx.get("loader") === void 0 || this.ctx.fiber.state !== FIBER_ACTIVE;
	}
	/**
	* Register the launcher-owned user-patch watchers on the serialized queue.
	* Runs when the tree settles (boot's post-audit mark): an absent HMR
	* service is mounted watch-only (no module roots), then one config watcher
	* per path recomposes the acknowledged snapshot. The whole setup is one
	* transactional scope: every loader entry this call creates and every
	* watcher disposer `registerConfig` returns is owned by the call and
	* reverse-disposed on any incomplete outcome — a later failure, an
	* `INACTIVE_EFFECT`, or the tree exiting — while pre-existing timer/HMR
	* services and entries are never touched. `INACTIVE_EFFECT` and every
	* other setup error are graceful only when the tree has actually exited
	* (the exit is what was asked, the gate stays closed and boot resolves);
	* the same error on a live tree is a real watcher-setup failure, so setup
	* rolls back and fails boot loud instead of resolving into a permanently
	* unusable half-initialized runtime. A disposal that lands between a
	* registration resolving and setup returning is caught by a liveness
	* recheck after every registration and once more at the end.
	* @returns false when the tree exited during setup or a watcher failed
	* gracefully (`INACTIVE_EFFECT` or any error on an exited tree) — the
	* mutation gate stays closed for a tree that never fully settled; true only
	* when every watcher is registered on a live tree.
	*/
	async registerWatchPatches() {
		if (this.watchPatches.length === 0) return !this.treeExited();
		if (this.treeExited()) return false;
		const owned = [];
		const rollback = async () => {
			for (const dispose of owned.splice(0).reverse()) try {
				await dispose();
			} catch {}
		};
		try {
			if (this.ctx.get("hmr") === void 0) {
				const loader = this.ctx.get("loader");
				if (loader === void 0) return false;
				if (this.ctx.get("timer") === void 0) {
					const id = await loader.create({ name: "@deepseek-ai/cordis-plugin-timer" });
					owned.push(() => loader.remove(id));
				}
				const id = await loader.create({
					name: "@deepseek-ai/cordis-plugin-hmr",
					config: { root: [] }
				});
				owned.push(() => loader.remove(id));
			}
			const hmr = this.ctx.get("hmr");
			if (hmr === void 0) {
				if (this.treeExited()) {
					await rollback();
					return false;
				}
				throw new Error("page-app profile runtime: the HMR service is unavailable for user-patch watching");
			}
			for (const watch of this.watchPatches) {
				const dispose = await hmr.registerConfig(watch.filename, () => this.recomposeInternal());
				owned.push(dispose);
				if (this.treeExited()) {
					await rollback();
					return false;
				}
			}
			return true;
		} catch (error) {
			await rollback();
			if (this.treeExited()) return false;
			throw error;
		}
	}
	/**
	* Acknowledge one staged manager-layer generation: verify the current
	* `runtime-layer.yml` equals the request's layer, parse and apply the
	* request's exact content through the serialized queue, wait for the
	* Include update and Loader settlement, audit every expected root reached
	* active state, and — only after the audit passes — promote the request's
	* layer to the acknowledged snapshot that watcher generations compose.
	* Rejects when the layer was not staged as requested, when the Include
	* update or activation fails, or when the audit finds a root that did not
	* mount or did not reach active state; a rejected apply never promotes the
	* candidate and never advances the generation.
	* @param request - the staged layer and its expected roots.
	* @returns the acknowledged generation with active roots and overrides.
	*/
	async applyManagerLayer(request) {
		return this.recomposeManagerLayer(request);
	}
	/**
	* Restore a prior manager-layer generation (the rollback path): identical
	* contract to {@link ProfileRuntimeState.applyManagerLayer}, distinguished
	* by the caller's intent so the manager can await the restored composition
	* the same way it awaits an apply.
	* @param request - the restored layer and its expected roots.
	* @returns the acknowledged generation with active roots and overrides.
	*/
	async restoreManagerLayer(request) {
		return this.recomposeManagerLayer(request);
	}
	async recomposeInternal() {
		this.assertMutable();
		await this.enqueue(async () => {
			await this.applyGeneration(this.compose(this.managerPatches));
		});
	}
	async recomposeManagerLayer(request) {
		this.assertMutable();
		return this.enqueue(async () => {
			if (await this.readStagedLayer() !== request.runtimeLayer) throw new Error("page-app profile runtime: staged runtime layer does not match the apply request; manager repair required");
			const patches = parseLayerDocument(request.runtimeLayer);
			await this.applyGeneration(this.compose(patches));
			const result = this.audit(request);
			this.managerPatches = patches;
			return result;
		});
	}
	assertMutable() {
		if (this.entry === void 0) throw new Error("page-app profile runtime: manager layer apply before the root Include is bound");
		if (!this.settled) throw new Error("page-app profile runtime: manager layer apply before the initial tree has settled");
	}
	enqueue(task) {
		const run = this.queue.then(task, task);
		this.queue = run.then(() => {}, () => {});
		return run;
	}
	async applyGeneration(patches) {
		const entry = this.entry;
		if (entry === void 0) throw new Error("page-app profile runtime: cannot recompose before the root Include is bound");
		const { patches: _previousPatches, ...includeConfig } = entry.options.config;
		await entry.update({ config: {
			...includeConfig,
			patches: [...patches]
		} });
		const loader = this.ctx.get("loader");
		if (loader !== void 0) await loader.await();
	}
	async readStagedLayer() {
		const paths = resolvePageAppProfilePaths(this.identity.directory);
		try {
			return await readFile(paths.runtimeLayer, "utf8");
		} catch (error) {
			if (error.code === "ENOENT") return void 0;
			throw error;
		}
	}
	audit(request) {
		const loader = this.ctx.get("loader");
		if (loader === void 0) throw new Error("page-app profile runtime: the Loader tree is gone during the activation audit");
		const entries = [...loader.entries()];
		const failures = [];
		const activeRoots = [];
		const externallyOverridden = [];
		for (const expected of request.expectedRoots) {
			const row = entries.find((entry) => entry.options.id === expected.rootEntryId);
			if (row === void 0) {
				failures.push(`managed root ${expected.rootEntryId} did not mount`);
				continue;
			}
			if (canonicalManagedRootHash(row.options) !== expected.hash) externallyOverridden.push(expected.rootEntryId);
			const fiber = row.fiber;
			if (fiber === void 0) {
				if (row.disabled) continue;
				failures.push(`managed root ${expected.rootEntryId} has no active fiber`);
				continue;
			}
			if (fiber.state === FIBER_ACTIVE) {
				activeRoots.push(expected.rootEntryId);
				continue;
			}
			failures.push(`managed root ${expected.rootEntryId} did not reach active state (fiber state ${String(fiber.state)})`);
		}
		if (failures.length > 0) throw new Error(`page-app profile runtime: root activation audit failed: ${failures.join("; ")}`);
		this.generation += 1;
		return {
			generation: this.generation,
			activeRoots,
			externallyOverridden
		};
	}
};
/** Module-private state registry keyed by the raw service instance. */
const states = /* @__PURE__ */ new WeakMap();
/**
* Resolve the module-private state by walking the traceable proxy chain to
* the registered raw instance. Every hop checks the state registry BEFORE
* following the proxy's `symbols.original` escape hatch, so a directly
* registered object resolves immediately: a raw instance's own properties —
* including a consumer-written `symbols.original` key — can never redirect
* state, because the raw instance is the registry key and the direct hit is
* returned first. Only objects that are NOT directly registered are unwrapped,
* one layer at a time, until the registered raw instance is reached; the walk
* stops on `undefined`, on a non-object target, and on any object already
* visited (a self/cycle reference) and reports the miss instead of looping.
* `this` inside a proxied method arrives as the shadow receiver, which also
* unwraps through the chain.
* @param runtime - the service instance in any raw or traceable proxy form.
* @returns the module-private state, or undefined when no hop is registered.
*/
function resolveState(runtime) {
	const visited = /* @__PURE__ */ new Set();
	let current = runtime;
	while (typeof current === "object" && current !== null) {
		if (visited.has(current)) return void 0;
		visited.add(current);
		const direct = states.get(current);
		if (direct !== void 0) return direct;
		current = current[symbols.original];
	}
}
/**
* Resolve the module-private state for a service instance, failing loud when
* the instance is not registered. A direct registry hit takes precedence at
* every hop; see {@link resolveState} for the full walk contract.
* @param runtime - the service instance in any raw or traceable proxy form.
* @returns the module-private state.
* @throws {Error} when no hop in the proxy chain is registered.
*/
function stateOf(runtime) {
	const state = resolveState(runtime);
	if (state === void 0) throw new Error("page-app profile runtime: state is unavailable for this instance");
	return state;
}
/**
* Resolve the launcher/boot-only control for a profile runtime. The control
* lives in the module-private state registry; it is not exported from the
* package entry surface, so consumers of the injected service cannot reach
* bind/settle/recompose through any public string, symbol, or package API.
* Directly registered raw instances are resolved without consulting any
* writable own property; only non-registered proxy forms are unwrapped, and
* only when the unwrapped chain resolves to a registered instance.
* @param runtime - the service instance (raw or any traceable proxy layer).
* @returns the control, or undefined when no hop in the proxy chain is
* registered (never happens for instances built through {@link ProfileRuntime}).
*/
function profileRuntimeControl(runtime) {
	return resolveState(runtime)?.control;
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
var ProfileRuntime = class extends Service {
	constructor(ctx, options) {
		super(ctx, PROFILE_RUNTIME_SERVICE);
		states.set(this, new ProfileRuntimeState(ctx, options));
	}
	/** The immutable active-profile identity; consumers cannot replace it. */
	get identity() {
		return stateOf(this).identity;
	}
	/** Package identity that owns the Feature Runtime Wrapper export. */
	get ownerPackageName() {
		return stateOf(this).ownerPackageName;
	}
	/** Startup recovery error when the registry is corrupt; managed roots failed closed. */
	get recoveryError() {
		return stateOf(this).recoveryError;
	}
	/** Roots the safe derived layer omitted at startup, with their reasons. */
	get omittedRoots() {
		return stateOf(this).omittedRoots;
	}
	/**
	* Acknowledge one staged manager-layer generation; see
	* {@link ProfileRuntimeState.applyManagerLayer} for the full contract.
	* @param request - the staged layer and its expected roots.
	* @returns the acknowledged generation with active roots and overrides.
	*/
	async applyManagerLayer(request) {
		return stateOf(this).applyManagerLayer(request);
	}
	/**
	* Restore a prior manager-layer generation (the rollback path); see
	* {@link ProfileRuntimeState.restoreManagerLayer} for the full contract.
	* @param request - the restored layer and its expected roots.
	* @returns the acknowledged generation with active roots and overrides.
	*/
	async restoreManagerLayer(request) {
		return stateOf(this).restoreManagerLayer(request);
	}
};
//#endregion
export { readPageAppRegistry as C, parsePageAppSourceDisplay as D, parsePageAppManifest as E, resolvePageAppProfilePaths as O, parsePageAppRegistry as S, assertPageAppSourceNoCredentials as T, readPageAppJournal as _, composeProfilePatches as a, writePageAppJournal as b, managerWrapperResolvable as c, readManagerLayerPatches as d, loadOptionalPatches as f, parsePageAppJournal as g, advancePageAppJournalPhase as h, canonicalManagedRootHash as i, prepareManagerRuntimeLayer as l, withPageAppProfileLock as m, ProfileRuntime as n, managedRootWrapperId as o, loadOverlayPatches as p, WORKBENCH_RUNTIME_SERVICE as r, managedRootWrapperRow as s, PROFILE_RUNTIME_SERVICE as t, profileRuntimeControl as u, removePageAppJournal as v, writePageAppRegistry as w, renderPageAppRuntimeLayer as x, snapshotPageAppJournalFiles as y };
export {
	PROFILE_RUNTIME_SERVICE,
	WORKBENCH_RUNTIME_SERVICE,
	ProfileRuntime,
	canonicalManagedRootHash,
	composeProfilePatches,
	loadOptionalPatches,
	loadOverlayPatches,
	managedRootWrapperId,
	managedRootWrapperRow,
	managerWrapperResolvable,
	prepareManagerRuntimeLayer,
	profileRuntimeControl,
	readManagerLayerPatches,
};
