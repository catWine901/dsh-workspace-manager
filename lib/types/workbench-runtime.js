/**
 * Workbench Runtime (design D4): the Host service a Feature Runtime Wrapper
 * injects and the only surface a Feature reaches through. The runtime carries
 * the minimal contract-v1 domain API — lifecycle disposal, workspace-surface
 * registration, events, storage get/set, and a host call seam — and is
 * provided under {@link WORKBENCH_RUNTIME_SERVICE} by the manager fiber, so
 * disposer removal deletes the service and Cordis re-evaluates every dependent
 * wrapper fiber (provider loss parks them PENDING; re-provide reloads them).
 * Every registered side effect is owned by the runtime's fiber and released in
 * reverse mount order when the fiber unloads. The contract's client render
 * wiring lands with the fixture migration (M9); this host half records the
 * surface seat and its owning package provenance.
 * @module @deepseek-ai/dsh-page-app-manager/workbench-runtime
 */
/** The service name the manager provides the Workbench Runtime under. */
export const WORKBENCH_RUNTIME_SERVICE = 'workbenchRuntime';
/**
 * Build the Workbench Runtime for one manager fiber. The runtime's ctx effect
 * owns every registered side effect: when the fiber unloads, disposer-owned
 * callbacks, surface seats, listeners, and storage release together, and the
 * service unregistration (Cordis's provide disposer) re-evaluates dependent
 * wrapper fibers.
 * @param ctx - the manager's plugin context (the providing fiber).
 * @returns the Feature-facing domain API.
 */
export function createWorkbenchRuntime(ctx) {
    const disposeCallbacks = new Set();
    const surfaceSeats = new Map();
    const listeners = new Map();
    const store = new Map();
    const release = () => {
        for (const callback of [...disposeCallbacks]) {
            try {
                callback();
            }
            catch {
                // One failing disposer must not hide the runtime release.
            }
        }
        disposeCallbacks.clear();
        surfaceSeats.clear();
        listeners.clear();
        store.clear();
    };
    ctx.effect(() => release, `${WORKBENCH_RUNTIME_SERVICE}: release every registered Workbench side effect with the manager fiber`);
    return {
        lifecycle: {
            onDispose: (callback) => {
                disposeCallbacks.add(callback);
                return () => { disposeCallbacks.delete(callback); };
            },
        },
        surfaces: {
            registerWorkspaceSurface: (registration) => {
                surfaceSeats.set(registration.pageId, Object.freeze({ ...registration }));
                return () => { surfaceSeats.delete(registration.pageId); };
            },
            list: () => [...surfaceSeats.values()],
        },
        events: {
            on: (name, listener) => {
                const existing = listeners.get(name);
                const set = existing ?? new Set();
                if (existing === undefined)
                    listeners.set(name, set);
                set.add(listener);
                return () => { set.delete(listener); };
            },
            emit: (name, payload) => {
                for (const listener of [...(listeners.get(name) ?? [])])
                    listener(payload);
            },
        },
        storage: {
            get: key => store.get(key),
            set: (key, value) => { store.set(key, value); },
        },
        host: {
            call: (method, ..._args) => {
                throw new Error(`page-app workbench: no host method "${method}" is wired (contract v1 wires host capabilities with the fixture migration)`);
            },
        },
    };
}
//# sourceMappingURL=workbench-runtime.js.map