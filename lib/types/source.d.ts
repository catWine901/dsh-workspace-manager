/**
 * Install-source parsing: classify one specifier the Settings add-flow accepts
 * into a validated pnpm source plus a redacted persisted display. Registry and
 * Git specs may be typed; local directory, `file:`, `link:`, and tarball
 * sources must come from the picker as absolute paths. Ambiguous relative
 * filesystem specs are rejected rather than resolved against Host cwd (spec
 * §10.1), and credential-bearing URLs are rejected (spec §7 / SR-07).
 * @module @deepseek-ai/dsh-page-app-manager/source
 */
import { type PageAppSourceKind } from '@deepseek-ai/dsh-page-app-profile';
import type { PageAppInstallSource } from './types.ts';
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
export declare function parsePageAppInstallSource(spec: string, kind?: PageAppSourceKind): PageAppInstallSource;
//# sourceMappingURL=source.d.ts.map