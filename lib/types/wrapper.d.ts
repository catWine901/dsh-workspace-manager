import { Context } from "@deepseek-ai/cordis";
import { z } from "zod";

//#region lib/types/wrapper.d.ts
/** Stable plugin name of one wrapper row. */
declare const name = "page-app-manager.wrapper";
/** The wrapper waits for the Workbench Runtime; provider loss parks it PENDING. */
declare const inject: string[];
/** Validated wrapper config: the feature's package/page identity the wrapper composes. */
declare const Config: z.ZodObject<{
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
declare function apply(ctx: Context, config: z.infer<typeof Config>): Promise<void>;
//#endregion
export { Config, apply, inject, name };