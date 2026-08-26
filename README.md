# DSH Workspace Manager

English | [中文](README.zh.md)

An out-of-tree Workspace Apps control plane for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It installs as a profile bundle and adds **Plugins → Workspace Apps** without making the built-in DSH shell depend on the manager.

## What it does

- Installs, enables, disables, hides, reorders, and uninstalls Workspace Apps per profile.
- Keeps `.workspace-manager/registry.json` as the sole ownership authority.
- Uses journaled transactions, a shared profile lock, live-tree rollback, and explicit recovery.
- Provides Workbench Contract v1 so managed Features stay Cordis-free.
- Preserves Native DSH when the manager is absent, disabled, reloading, or fails to render.
- Keeps package management and profile-file writes on the Host; the browser only calls the authorized Remote surface.

## Install

Requirements: a DeepSeek Harness 0.1.1-rc.2 source build (or a later compatible 0.1.x release), Node.js 20 or newer, and pnpm 11.7.0 on `PATH`. This package uses seams introduced after 0.1.0-rc.6 and is not compatible with the older 0.1.0-rc.6 public release.

```sh
dsh plugin --profile <profile> add @catwine901/dsh-workspace-manager@1.0.0
dsh --profile <profile>
```

Open **Plugins → Workspace Apps** to manage compatible Workspace App packages.

To update or remove the manager:

```sh
dsh plugin --profile <profile> update @catwine901/dsh-workspace-manager
dsh plugin --profile <profile> remove @catwine901/dsh-workspace-manager
```

The repository can also be installed directly when it contains the release artifacts:

```sh
dsh plugin --profile <profile> add github:catWine901/dsh-workspace-manager
```

## Architecture

The package combines three faces behind one installable bundle:

- **Profile core** owns paths, registry parsing, the mutation lock, journals, and deterministic runtime-layer documents.
- **Host manager** validates packages, runs transactions, projects state, and exposes the authorized `pageAppManager` Remote service.
- **Browser manager** renders settings and talks to the Host through generated Remote bindings; it never runs pnpm or writes profile files.

Managed Features run below a Feature Runtime Wrapper. Provider loss parks the Feature subtree through the normal loader lifecycle; provider return reloads it. The normative API is documented in [Workbench Contract v1](docs/workbench-contract-v1.md).

## Security and lifecycle guarantees

- Install sources are parsed as arguments; no shell command string is assembled.
- The manager never broadens pnpm `allowBuilds` and never deletes a user's pnpm store or source directory.
- Mutations are serialized per profile and either commit or restore the prior live layer and files.
- Activation acknowledgements are revision-bound and timeout-bounded.
- Profiles keep independent registries, orders, revisions, packages, and recovery state.
- A Workspace Feature that imports or depends on Cordis is rejected by the source, manifest, and admission boundaries.

## Compatibility and limits

- This 1.0.0 release targets the DSH 0.1.1-rc.2 seam packages and `@deepseek-ai/cordis` 4.0.x.
- Installation requires the Host client-module registry because activation must be acknowledged against an exact client-graph revision.
- Packages that need install scripts may require an operator-managed pnpm build allowance; the manager will not grant it automatically.
- Registry and user data are retained when the manager or an individual Workspace App is removed.

## Repository and release model

This repository is a deterministic distribution snapshot generated from the DeepSeek Harness monorepo. It contains the normalized source packages, tests, Workbench Contract, and prebuilt `lib/` artifacts shipped to npm. A release is accepted only after tarball content scanning and a fresh-profile install → start → disable → re-enable → uninstall smoke test.

## License

[MIT](LICENSE)
