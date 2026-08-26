# DSH Workspace Manager

[English](README.md) | 中文

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的树外 Workspace Apps 控制面。它作为 profile bundle 安装并提供 **Plugins → Workspace Apps**，同时保持内置 DSH shell 不依赖 Manager。

## 功能

- 按 profile 安装、启用、禁用、隐藏、排序和卸载 Workspace App。
- 以 `.workspace-manager/registry.json` 作为唯一 ownership 权威。
- 使用日志事务、共享 profile 锁、live tree 回滚和显式恢复。
- 提供 Workbench Contract v1，使受管 Feature 自身保持 Cordis-free。
- Manager 缺失、禁用、重载或渲染失败时，Native DSH 仍可使用。
- 包管理与 profile 文件写入仅发生在 Host；浏览器只调用经过授权的 Remote 接口。

## 安装

要求：DeepSeek Harness 0.1.1-rc.2 源码构建（或后续兼容的 0.1.x 版本）、Node.js 20 或更高版本，并确保 pnpm 11.7.0 位于 `PATH`。本包依赖 0.1.0-rc.6 之后新增的 seam，因此不兼容较旧的 0.1.0-rc.6 公共版本。

```sh
dsh plugin --profile <profile> add @catwine901/dsh-workspace-manager@1.0.0
dsh --profile <profile>
```

打开 **Plugins → Workspace Apps** 管理兼容的 Workspace App 包。

更新或移除 Manager：

```sh
dsh plugin --profile <profile> update @catwine901/dsh-workspace-manager
dsh plugin --profile <profile> remove @catwine901/dsh-workspace-manager
```

当 GitHub 仓库已包含发布产物时，也可以直接安装：

```sh
dsh plugin --profile <profile> add github:catWine901/dsh-workspace-manager
```

## 架构

单个可安装 bundle 组合三个部分：

- **Profile core**：负责路径、registry 解析、变更锁、事务日志和确定性 runtime layer 文档。
- **Host Manager**：负责包校验、事务、状态投影以及经过授权的 `pageAppManager` Remote 服务。
- **Browser Manager**：负责 Settings 界面，并通过生成的 Remote 绑定与 Host 通信；它不会运行 pnpm，也不会写 profile 文件。

受管 Feature 位于 Feature Runtime Wrapper 下。Provider 丢失时，Feature 子树通过正常 loader 生命周期进入等待；Provider 恢复时自动重载。规范 API 见 [Workbench Contract v1](docs/workbench-contract-v1.md)。

## 安全与生命周期保证

- 安装源以参数形式解析，不拼接 shell 命令字符串。
- Manager 不会放宽 pnpm `allowBuilds`，也不会删除用户的 pnpm store 或源码目录。
- 每个 profile 的变更串行执行；事务要么提交，要么恢复此前的 live layer 与文件。
- 激活确认绑定精确 revision，并受超时限制。
- 不同 profile 的 registry、排序、revision、包和恢复状态彼此独立。
- 导入或依赖 Cordis 的 Workspace Feature 会被源码、manifest 和安装准入边界拒绝。

## 兼容性与限制

- 1.0.0 面向 DSH 0.1.1-rc.2 seam 包与 `@deepseek-ai/cordis` 4.0.x。
- 安装依赖 Host client-module registry，因为激活必须对精确 client graph revision 完成确认。
- 如果包需要执行安装脚本，操作者可能需要自行配置 pnpm build allowance；Manager 不会自动授权。
- 移除 Manager 或单个 Workspace App 时，registry 与用户数据会被保留。

## 仓库与发布模型

本仓库是从 DeepSeek Harness monorepo 确定性生成的发布快照，包含规范化源码包、测试、Workbench Contract，以及发布到 npm 的预构建 `lib/` 产物。发布前必须通过 tarball 内容扫描和 fresh profile 的安装 → 启动 → 禁用 → 重新启用 → 卸载 smoke test。

## 许可证

[MIT](LICENSE)
