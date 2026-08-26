/**
 * Static Workspace Plugin Contract validation (spec §11). One installed
 * package is validated against the manager registry and the effective profile
 * facts BEFORE ownership state changes: the manager can safely stage a
 * dependency and prove it satisfies the v1 contract without mutating anything.
 * @module @deepseek-ai/dsh-page-app-manager/validation
 */
import { type EntryOptions } from './adapter.ts';
import { type PageAppManifest, type PageAppRegistryV1 } from '@deepseek-ai/dsh-page-app-profile';
/** Profile facts the validation compares the staged package against. */
export interface PageAppValidationContext {
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
export interface PageAppValidatedRecord {
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
export declare function resolveInstalledPackageDir(profileDir: string, packageName: string): string | undefined;
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
export declare function validateInstalledPageAppPackage(profileDir: string, packageName: string, context: PageAppValidationContext): PageAppValidatedRecord;
//# sourceMappingURL=validation.d.ts.map