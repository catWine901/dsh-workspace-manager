//#region src/host-bridge/index.ts
/** Stable Workspace Manager <-> DSH contract. Host-private types never cross this file. */
const WORKSPACE_HOST_BRIDGE_VERSION = 1;
const WORKSPACE_HOST_ADAPTER_SERVICE = "workspaceHostAdapter";
function auditHostDescriptor(descriptor) {
	const present = new Set(descriptor.capabilities);
	return Object.freeze({
		detectedHostVersion: descriptor.hostVersion,
		selectedAdapterId: descriptor.adapterId,
		adapterVersion: descriptor.adapterVersion,
		integrationMode: descriptor.integrationMode,
		capabilityChecks: Object.freeze(Object.fromEntries([
			"native-surface",
			"navigation",
			"panels",
			"host-events",
			"page-app-remote",
			"bundle-composition"
		].map((name) => [name, present.has(name)])))
	});
}

//#endregion
export { WORKSPACE_HOST_ADAPTER_SERVICE, WORKSPACE_HOST_BRIDGE_VERSION, auditHostDescriptor };