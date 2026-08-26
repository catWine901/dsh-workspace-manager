/**
 * Feature Runtime Wrapper (design D4, F-7): the named function plugin the
 * manager's runtime layer mounts as the parent row of every enabled,
 * statically valid Feature. The wrapper injects the {@link WORKBENCH_RUNTIME_SERVICE}
 * (so provider loss parks its fiber PENDING and return reloads it), mounts the
 * already-composed feature rows as Loader entries (each keeping its own entry
 * and fiber), and exposes only the contract surface to the Feature: the
 * feature's surface seat registers with its owning package provenance. The
 * module itself is the strict-mode boundary — a Feature never imports Cordis,
 * and the wrapper is the only host code that composes it.
 * @module @deepseek-ai/dsh-page-app-manager/wrapper
 */
import type { Context } from '@deepseek-ai/cordis';
import { z } from 'zod';
/** Stable plugin name of one wrapper row. */
export declare const name = "page-app-manager.wrapper";
/** The wrapper waits for the Workbench Runtime; provider loss parks it PENDING. */
export declare const inject: string[];
/** Validated wrapper config: the feature's package/page identity the wrapper composes. */
export declare const Config: z.ZodObject<{
    packageName: z.ZodString;
    pageId: z.ZodString;
    rootEntryId: z.ZodString;
    contractVersion: z.ZodNumber;
}, z.core.$strip>;
/**
 * Mount one wrapper row: mount the already-composed feature rows as Loader
 * entries (reverse-disposed with the wrapper fiber) and register the feature's
 * surface seat through the injected Workbench Runtime with the feature package
 * as its owner. Every side effect is owned by the wrapper fiber, so unload
 * (provider loss, disable, uninstall) releases the mounted rows and the seat
 * together.
 * @param ctx - the wrapper entry's context (inherits the Loader service and
 * injects the Workbench Runtime).
 * @param config - the validated wrapper config.
 */
export declare function apply(ctx: Context, config: z.infer<typeof Config>): Promise<void>;
//# sourceMappingURL=wrapper.d.ts.map