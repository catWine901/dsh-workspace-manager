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
import type { ProfileRuntime } from '@deepseek-ai/dsh-app-boot';
import type { PageAppPackageExecutor } from './executor.ts';
/** The recovery decision for one profile. */
export type PageAppRecoveryAction = 'none' | 'commit-completed' | 'restored' | 'recovery-required';
/** Outcome of one recovery attempt. */
export interface PageAppRecoveryOutcome {
    readonly action: PageAppRecoveryAction;
    /** Actionable message when the outcome is not silent. */
    readonly message?: string;
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
export declare function recoverPageAppTransaction(profileDir: string, executor: PageAppPackageExecutor, runtime: ProfileRuntime): Promise<PageAppRecoveryOutcome>;
/** The owned-file list is exported for the recovery-table tests. */
export declare const RECOVERY_OWNED_FILES: readonly string[];
//# sourceMappingURL=recovery.d.ts.map