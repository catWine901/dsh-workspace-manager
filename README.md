# DSH Workspace Manager

[中文](README.zh.md) | English

Workspace Manager is the outermost DSH workspace shell. When active, the real native DSH surface is mounted under `WorkspaceContentRegion`; disabling or uninstalling the plugin reveals the untouched native DSH root again.

```text
WorkspaceRootShell
└── WorkspaceContentRegion
    └── NativeDshSurface
```

Install the single self-contained package on a supported stock DSH:

```bash
dsh plugin --profile web add @tingyu9527/dsh-workspace-manager
```

No host patch, separate seam, copied file, or DSH installation-directory change is required. Remove it with the standard DSH plugin command:

```bash
dsh plugin --profile web remove @tingyu9527/dsh-workspace-manager
```

Core and Features depend only on the stable internal `WorkspaceHostBridge v1`. DSH `0.1.1-rc.2` layout, Remote, Event, and private capability differences are isolated in the `dsh-0.1.1-rc.2-layout-replacement` adapter. Its bundle layer suspends the original `ui-layout`; removing the package removes that layer and restores the untouched native layout.

See [`compatibility.json`](compatibility.json) for the machine-readable support matrix and [Workbench Contract v1](docs/workbench-contract-v1.md) for Feature integration.

[MIT License](LICENSE)
