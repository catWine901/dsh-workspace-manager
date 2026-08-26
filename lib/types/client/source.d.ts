/**
 * Client-side install-source classifier (spec §24): one source field in the
 * Settings add-flow becomes a typed {@link PageAppInstallSource} the
 * controller hands to the generated Remote. Mirrors the Host grammar (bare
 * registry names, `npm:`, git forms, picker-backed absolute `file:`/`link:`/
 * tarball paths) with client-safe checks — no `node:path`, no credentials
 * accepted. The Host re-validates on its side; this only classifies for
 * display and transport.
 * @module @deepseek-ai/dsh-client-ui-page-app-manager/client/source
 */
import type { PageAppInstallSource } from '@deepseek-ai/dsh-page-app-manager/types';
/**
 * Parse one install source spec into a typed, redacted source record.
 * @param spec - the raw specifier from the Settings add-flow.
 * @returns the immutable validated install source.
 * @throws {Error} for credential-bearing URLs, empty specs, kind mismatches,
 * or ambiguous relative filesystem specs.
 */
export declare function parsePageAppInstallSourceClient(spec: string): PageAppInstallSource;
//# sourceMappingURL=source.d.ts.map