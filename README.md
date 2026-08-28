# DSH Workspace Manager — RC2 root-shell prerelease

English | [中文](README.zh.md)

Version `1.0.1-workspace-shell.1` is a **prerelease without full acceptance**, distributed under the npm `next` tag. The Manager remains a separate package. Public DSH 0.1.1-rc.2 also requires the explicit host patch included here; installing the Manager alone on an unmodified RC2 host does not provide the new shell.

## Install

With DSH stopped, apply the host patch below using a local copy of this repository or an extracted npm package, then install the Manager into the intended DSH profile:

```sh
dsh plugin --profile web add @tingyu9527/dsh-workspace-manager@1.0.1-workspace-shell.1
```

Use the same `DSH_HOME` as your normal web instance. Restart DSH afterwards. The package does not automatically modify the host on installation. Existing stable users remain on `latest` (`1.0.1`).

## Composition

The host retains its root registration and original AppFrame. A new `page-app.shell` slot passes that original element to the Manager. The Manager renders a permanent 166px navigation column and a sibling content area containing Native DSH and visited managed pages. Navigation toggles visibility without unmounting those pages. Disabled, uninstalled or ineligible pages are still evicted normally.

This does not embed an iframe, move existing DOM nodes, rebuild DSH chat, or ship a new knowledge-base application. Entries come from installed Workspace Apps.

## Build and host patch

```sh
node scripts/build-client.mjs
node scripts/build-client.mjs --toolchain "<existing DSH source toolchain>"
node scripts/patch-host.mjs status "<DSH installation directory>"
node scripts/patch-host.mjs apply "<DSH installation directory>"
node scripts/patch-host.mjs restore "<DSH installation directory>"
```

The client builder reads this directory's `src/client`, updates `lib/client.js`, and synchronizes the historical `packages/ui-page-app-manager/src` mirror. Existing Host Manager artifacts remain unchanged. Build dependencies can come from an existing toolchain; no new DSH download is needed.

The patch accepts only the pinned RC2 version and two known artifact hashes, backs up originals, and replaces files atomically without writing through pnpm hardlinks. It adds a host shell slot with a Native DSH fallback and forwards the two Manager lifecycle events. Restart DSH and refresh the browser after applying or restoring it. DSH reinstalls/upgrades may replace the patched files.

## Status

Only compilation, JavaScript syntax, component-level visibility/DOM retention, and patch hash checks were performed. No four-layer acceptance, full regression, real Feature installation, or browser visual acceptance was run. Shell installation/removal may remount Native DSH; the keep-mounted guarantee concerns ordinary page navigation.

See [change report and deployment instructions](docs/2026-08-28-workspace-shell-changes.md), [Workbench Contract v1](docs/workbench-contract-v1.md), and [MIT license](LICENSE).
