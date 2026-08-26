/**
 * Static Workspace Plugin Contract validation (spec §11). One installed
 * package is validated against the manager registry and the effective profile
 * facts BEFORE ownership state changes: the manager can safely stage a
 * dependency and prove it satisfies the v1 contract without mutating anything.
 * @module @deepseek-ai/dsh-page-app-manager/validation
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { composePatchRows, parseEntryList } from "./adapter.js";
import { SUPPORTED_CONTRACT_VERSIONS, assertSupportedContractVersion } from "./contract.js";
import { parsePageAppManifest, renderPageAppRuntimeLayer, } from '@deepseek-ai/dsh-page-app-profile';
/**
 * Probe the installed location of one package from the profile's own
 * node_modules walk — the same anchor the profile runtime uses. Manager
 * packages are profile-local pnpm installs, so the profile anchor finds them
 * before any parent fallback.
 * @param profileDir - absolute profile directory.
 * @param packageName - the package name to locate.
 * @returns the installed package directory, or undefined when not installed.
 */
export function resolveInstalledPackageDir(profileDir, packageName) {
    for (const searchPath of createRequire(join(profileDir, 'package.json')).resolve.paths(packageName) ?? []) {
        const candidate = join(searchPath, packageName);
        if (existsSync(join(candidate, 'package.json')))
            return candidate;
    }
    return undefined;
}
/** Whether one path stays inside `root` (symlink-free containment check). */
function isInside(root, candidate) {
    const rel = relative(root, candidate);
    return rel !== '' && !rel.startsWith('..' + sep) && rel !== '..' && !isAbsolutePath(rel);
}
function isAbsolutePath(value) {
    return value.startsWith(sep) || /^[a-zA-Z]:[\\/]/.test(value);
}
/** Direct Cordis dependencies a Strict Mode Feature must never declare (G-8). */
const FORBIDDEN_DIRECT_DEPENDENCIES = ['cordis', '@deepseek-ai/cordis'];
/** Every package.json dependency section the boundary checks (matches the source-boundary gate). */
const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
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
        if (dependencies === undefined)
            continue;
        if (typeof dependencies !== 'object' || dependencies === null || Array.isArray(dependencies)) {
            throw new Error(`page-app validation: "${packageName}" package.json ${section} must be a record`);
        }
        for (const forbidden of FORBIDDEN_DIRECT_DEPENDENCIES) {
            if (Object.hasOwn(dependencies, forbidden)) {
                throw new Error(`page-app validation: "${packageName}" declares a direct ${forbidden} dependency (${section}) `
                    + '(Strict Mode features must not depend on Cordis; the Adapter absorbs Cordis changes)');
            }
        }
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
export function validateInstalledPageAppPackage(profileDir, packageName, context) {
    const packageDir = resolveInstalledPackageDir(profileDir, packageName);
    if (packageDir === undefined) {
        throw new Error(`page-app validation: "${packageName}" is not installed in the profile`);
    }
    let pkg;
    try {
        pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
    }
    catch (error) {
        throw new Error(`page-app validation: "${packageName}" package.json is unreadable: ${String(error)}`);
    }
    if (typeof pkg.name !== 'string' || pkg.name === '') {
        throw new Error(`page-app validation: "${packageName}" package.json carries no valid name`);
    }
    if (pkg.name !== packageName) {
        throw new Error(`page-app validation: package name "${pkg.name}" does not equal the direct dependency key "${packageName}" (pnpm alias installs are rejected in v1)`);
    }
    if (typeof pkg.version !== 'string' || pkg.version === '') {
        throw new Error(`page-app validation: "${packageName}" package.json carries no valid version`);
    }
    const directSpec = context.profileDependencies[packageName];
    if (directSpec === undefined) {
        throw new Error(`page-app validation: "${packageName}" is not a direct dependency of the profile — remove it through its original `
            + 'installation method, then install it again through Workspace Apps (no auto-adoption in v1)');
    }
    if (context.profileBundles.includes(packageName)) {
        throw new Error(`page-app validation: "${packageName}" is already installed as an external profile bundle — remove it through its original installation method first`);
    }
    const bundle = pkg.dsh?.bundle;
    if (typeof bundle?.patch !== 'string' || bundle.patch === '') {
        throw new Error(`page-app validation: "${packageName}" declares no dsh.bundle.patch`);
    }
    const patchPath = resolve(packageDir, bundle.patch);
    if (!isInside(packageDir, patchPath)) {
        throw new Error(`page-app validation: "${packageName}" dsh.bundle.patch resolves outside the installed package`);
    }
    if (!existsSync(patchPath)) {
        throw new Error(`page-app validation: "${packageName}" dsh.bundle.patch does not exist at ${patchPath}`);
    }
    // Contract version gate (design D2): the supportedContractVersions constant
    // is the manager's single source of truth for version admission. The gate
    // runs before the manifest parse, so an unsupported numeric schema version
    // is rejected by the constant; a missing or non-numeric schemaVersion keeps
    // the manifest shape error from parsePageAppManifest.
    const schemaVersion = pkg.dsh?.workspace?.schemaVersion;
    if (typeof schemaVersion === 'number') {
        assertSupportedContractVersion(schemaVersion, SUPPORTED_CONTRACT_VERSIONS);
    }
    // The workspace manifest (schemaVersion, every required field non-empty).
    const manifest = parsePageAppManifest(packageName, pkg);
    // Strict Mode dependency boundary (design D2 / G-8): a Feature must not
    // declare Cordis itself — the Adapter absorbs Cordis changes for it. The
    // check reads the installed package.json, so it runs after pnpm staging and
    // before any registry/ownership mutation; nothing owned changes here.
    rejectForbiddenDependencies(packageName, pkg);
    // Uniqueness axes (spec §11): page id, package name, root id.
    for (const row of context.registry?.entries ?? []) {
        if (row.packageName === packageName) {
            throw new Error(`page-app validation: "${packageName}" is already managed in this profile`);
        }
        if (row.page.id === manifest.id) {
            throw new Error(`page-app validation: workspace page id "${manifest.id}" is already managed in this profile`);
        }
        if (row.page.rootEntryId === manifest.rootEntryId) {
            throw new Error(`page-app validation: managed root id "${manifest.rootEntryId}" is already managed in this profile`);
        }
    }
    if (context.baseRootIds.includes(manifest.rootEntryId)) {
        throw new Error(`page-app validation: managed root id "${manifest.rootEntryId}" collides with the base composition below the manager layer`);
    }
    // Compose the bundle patch over an empty root exactly as the boot include
    // mounts a layer; ANY warning (an ignored/missing patch target) rejects.
    let raw;
    try {
        raw = parseEntryList(readFileSync(patchPath, 'utf8'));
    }
    catch (error) {
        throw new Error(`page-app validation: "${packageName}" bundle patch failed to parse: ${String(error)}`);
    }
    if (!Array.isArray(raw)) {
        throw new Error(`page-app validation: "${packageName}" bundle patch must be a top-level YAML array of loader entries`);
    }
    const warnings = [];
    let composed;
    try {
        composed = composePatchRows(raw, (message) => { warnings.push(message); });
    }
    catch (error) {
        throw new Error(`page-app validation: "${packageName}" bundle patch failed to compose: ${String(error)}`);
    }
    if (warnings.length > 0) {
        throw new Error(`page-app validation: "${packageName}" bundle patch targets rows the empty root lacks: ${warnings.join('; ')}`);
    }
    const rootRows = composed.filter(row => row.id === manifest.rootEntryId);
    if (rootRows.length !== 1) {
        throw new Error(`page-app validation: "${packageName}" bundle composes ${String(rootRows.length)} top-level root(s) with id `
            + `"${manifest.rootEntryId}" (exactly one required)`);
    }
    const rootRow = rootRows[0];
    if (rootRow === undefined) {
        throw new Error(`page-app validation: "${packageName}" root row is unavailable`);
    }
    if (typeof rootRow.name === 'string' && (rootRow.name.startsWith('.') || rootRow.name.startsWith('/'))) {
        throw new Error(`page-app validation: "${packageName}" managed root uses a relative Loader module name "${rootRow.name}"`);
    }
    // Declarative + serializable: the runtime-layer renderer rejects `!!js`
    // expressions and unserializable trees.
    try {
        renderPageAppRuntimeLayer([{ packageName, pageId: manifest.id, rootEntryId: manifest.rootEntryId, enabled: true, entries: [rootRow] }]);
    }
    catch (error) {
        throw new Error(`page-app validation: "${packageName}" managed root is not declarative/serializable: ${String(error)}`);
    }
    // Web client validity: declared platform web, an exported ./client artifact
    // that exists, and exactly one composed client row for this package.
    const client = pkg.dsh?.client;
    if (typeof client !== 'object' || client === null || client.platform !== 'web') {
        throw new Error(`page-app validation: "${packageName}" must declare dsh.client with platform "web"`);
    }
    const clientExport = clientExportOf(packageName, pkg.exports);
    if (clientExport === undefined) {
        throw new Error(`page-app validation: "${packageName}" exports no "./client" bundle`);
    }
    if (!existsSync(join(packageDir, clientExport))) {
        throw new Error(`page-app validation: "${packageName}" ./client artifact is missing at ${clientExport}`);
    }
    const external = client.external;
    const externals = external === undefined ? [] : external;
    if (!Array.isArray(externals) || externals.some(spec => typeof spec !== 'string')) {
        throw new Error(`page-app validation: "${packageName}" dsh.client.external must be a string array`);
    }
    if (externals.includes(packageName)) {
        throw new Error(`page-app validation: "${packageName}" requests itself in dsh.client.external`);
    }
    const clientRows = composed.filter(row => row.name === packageName);
    if (clientRows.length !== 1) {
        throw new Error(`page-app validation: "${packageName}" bundle composes ${String(clientRows.length)} client row(s) for itself (exactly one required)`);
    }
    return Object.freeze({
        packageName,
        version: pkg.version,
        manifest,
        rootEntryId: manifest.rootEntryId,
        rootRow: Object.freeze({ ...rootRow }),
        clientRowCount: clientRows.length,
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
    if (typeof exportsField !== 'object' || exportsField === null)
        return undefined;
    const client = exportsField['./client'];
    if (client === undefined)
        return undefined;
    if (typeof client === 'string')
        return client;
    if (typeof client === 'object' && client !== null) {
        const fallback = client.default;
        if (typeof fallback === 'string')
            return fallback;
    }
    throw new Error(`page-app validation: "${packageName}" exports["./client"] must be a string or an object with a string default`);
}
//# sourceMappingURL=validation.js.map