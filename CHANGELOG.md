# Changelog

## Unreleased

## 1.1.0

- Preserve the native DSH viewport-height and overflow containing block inside the Workspace Shell, so long session lists scroll internally without pushing the conversation surface below the viewport.

- Make Workspace Manager the outermost Shell and mount the reconstructed native RC2 DSH Surface inside `WorkspaceContentRegion`.
- Add `WorkspaceHostBridge v1` and isolate RC2 layout, profile runtime, Remote, and Event mappings in an exact-version Host Adapter.
- Replace RC2 `ui-layout` only through DSH bundle composition; remove all host patch scripts and build-artifact mutation paths.
- Add a machine-readable compatibility matrix, fail-closed adapter selection, standalone Host/Client builds, and package hygiene verification.
- Verify offline single-package install, browser-side Shell nesting, clean console output, uninstall restoration, and unchanged global DSH artifacts against stock DSH `0.1.1-rc.2`.

## 1.0.1

- Fix external-consumer installation for public npm-form DSH 0.1.1-rc.2 by inlining the unpublished profile implementation, so ordinary npm users can install without a DSH source build.
- Provide an audited legacy compatibility bridge that is a no-op when the native ProfileRuntime capability exists.
- Publish the exact standalone dependency and peer boundary used by the Host and Client artifacts.

## 1.0.0

- Establish the out-of-tree Workspace Manager repository and package contract.
