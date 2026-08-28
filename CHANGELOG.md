# Changelog

## 1.0.1-workspace-shell.1 — 2026-08-28 (next)

- Prerelease root-shell build: replace the RC2 overlay with a host-declared `page-app.shell` wrapper and a permanent layout column.
- Keep Native DSH and visited managed pages mounted across ordinary navigation.
- Add hash-guarded, reversible RC2 host patches for the wrapper slot and two Manager lifecycle events.
- Build the client directly from this standalone snapshot; preserve existing Host Manager artifacts.
- Full acceptance and real Feature installation remain unverified.

## 1.0.1

- Fix external-consumer installation for public npm-form DSH 0.1.1-rc.2 by inlining the unpublished profile implementation, so ordinary npm users can install without a DSH source build.
- Provide an audited legacy compatibility bridge that is a no-op when the native ProfileRuntime capability exists.
- Publish the exact standalone dependency and peer boundary used by the Host and Client artifacts.

## 1.0.0

- Establish the out-of-tree Workspace Manager repository and package contract.
