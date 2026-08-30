# DSH Workspace Manager

[English](README.md) | 中文

Workspace Manager 是 DSH 的最外层工作区 Shell。激活后，真实的原生 DSH Surface 被挂载在 `WorkspaceContentRegion` 中；停用或卸载插件后，原生 DSH 根布局自动恢复。

```text
WorkspaceRootShell
└── WorkspaceContentRegion
    └── NativeDshSurface
```

## 安装

在受支持的原版 DSH 上只需一条标准命令：

```bash
dsh plugin --profile web add @tingyu9527/dsh-workspace-manager
```

无需宿主补丁、独立 seam、文件复制或 DSH 安装目录修改。停用/卸载使用 DSH 标准插件命令：

```bash
dsh plugin --profile web remove @tingyu9527/dsh-workspace-manager
```

## 架构边界

- Core 和 Features 仅依赖包内稳定的 `WorkspaceHostBridge v1`。
- DSH `0.1.1-rc.2` 的布局、Remote、Event 与私有能力都由 `dsh-0.1.1-rc.2-layout-replacement` Adapter 收敛。
- RC2 根接管通过 `dsh.bundle.patch` 暂停原生 `ui-layout` 并插入 Adapter 与 Manager；移除包后该组合层消失，未修改的原生布局自动恢复。
- 启动先校验 Host 版本、Adapter 标识、Bridge 版本与能力集，未知版本在注册 Workspace 根节点前失败。

支持矩阵见 [`compatibility.json`](compatibility.json)。

## 本地验证

构建命令可以复用已有 DSH 和已有工具链，不会下载 DSH：

```powershell
node scripts/build-host.mjs --toolchain "<已有 DSH 源码工具链>" --runtime "<全局 DSH 包目录>"
node scripts/build-client.mjs --toolchain "<已有 DSH 源码工具链>" --runtime "<全局 DSH 包目录>"
node scripts/test.mjs
```

[Workbench Contract v1](docs/workbench-contract-v1.md) · [MIT License](LICENSE)
