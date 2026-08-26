/** Package-owned invariant companion. @module @deepseek-ai/dsh-page-app-manager/invariant */
const PACKAGE_NAME = '@deepseek-ai/dsh-page-app-manager';
/** Cordis companion plugin name. */
export const name = 'page-app-manager-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/** No runtime invariant yet: ownership truth and health are projected from registry + Loader facts. */
const install = () => {
    // No runtime invariant: the registry is the sole ownership authority and
    // every projection derives from it plus live Loader facts, both pinned by
    // the manager test suite rather than a runtime check.
};
/** Register this package's invariant companion. */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
/* jscpd:ignore-end */
//# sourceMappingURL=invariant.js.map