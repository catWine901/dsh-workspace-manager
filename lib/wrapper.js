import { h as require_zod } from "./profile-runtime-bridge-BAIkQibq.mjs";
import { d as wrapperChildrenOf, l as mountWrapperChildren, t as WORKBENCH_RUNTIME_SERVICE } from "./workbench-runtime-AOqDkwdX.mjs";

//#region src/host/wrapper.ts
var import_zod = require_zod();
/** Stable plugin name of one wrapper row. */
const name = "page-app-manager.wrapper";
/** The wrapper waits for the Workbench Runtime; provider loss parks it PENDING. */
const inject = [WORKBENCH_RUNTIME_SERVICE];
/** Validated wrapper config: the feature's package/page identity the wrapper composes. */
const Config = import_zod.z.object({
	/** The managed feature package name (the wrapper's ownerPackage lineage). */
	packageName: import_zod.z.string().min(1),
	/** The managed page id (the surface seat key). */
	pageId: import_zod.z.string().min(1),
	/** The feature's composed root row id. */
	rootEntryId: import_zod.z.string().min(1),
	/** The admitted contract version of the feature's manifest. */
	contractVersion: import_zod.z.number().int().positive()
});
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
async function apply(ctx, config) {
	const children = wrapperChildrenOf(ctx);
	if (children !== void 0) {
		const disposeChildren = await mountWrapperChildren(ctx, children);
		ctx.effect(() => disposeChildren, "page-app-manager.wrapper: dispose the mounted feature rows with the wrapper fiber");
	}
	const disposeSurface = ctx.workbenchRuntime.surfaces.registerWorkspaceSurface({
		pageId: config.pageId,
		packageName: config.packageName
	});
	ctx.effect(() => () => {
		disposeSurface();
	}, "page-app-manager.wrapper: unregister the feature surface seat with the wrapper fiber");
}

//#endregion
export { Config, apply, inject, name };