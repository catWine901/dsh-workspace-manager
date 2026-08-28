/**
 * Injected inside RC2 ui-layout's existing client factory by patch-host.mjs.
 * AppFrame retains its original store/actions and authorized renderSlot binding.
 * The Manager wraps that element; no second React root or DOM reparenting is used.
 */
function createWorkspaceRoot(AppFrame, jsx) {
  return function WorkspaceRoot(props) {
    const nativeSurface = jsx(AppFrame, props);
    return props.renderSlot("page-app.shell", { nativeSurface }, { fallback: nativeSurface });
  };
}

/** Lower-priority live occupant also handles Manager render-error abdication. */
function NativeSurfaceFallback({ nativeSurface }) {
  return nativeSurface;
}
