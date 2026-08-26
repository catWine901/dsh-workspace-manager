//#region lib/types/invariant.js
/** Package-owned invariant companion. @module @deepseek-ai/dsh-page-app-manager/invariant */
const PACKAGE_NAME = "@deepseek-ai/dsh-page-app-manager";
/** Cordis companion plugin name. */
const name = "page-app-manager-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/** No runtime invariant yet: ownership truth and health are projected from registry + Loader facts. */
const install = () => {};
/** Register this package's invariant companion. */
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
