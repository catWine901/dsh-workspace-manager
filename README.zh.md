# DSH Workspace Manager（RC2 外壳预发布版）

[English](README.md) | 中文

版本 `1.0.1-workspace-shell.1` 是 **未完成完整验收的预发布版**，使用 npm `next` 标签。它仍然是独立 Manager 包，但公开 DSH 0.1.1-rc.2 必须先应用随包提供的宿主补丁；仅安装到未修改的公开 RC2 不会获得完整外壳效果。

## 安装

停止 DSH 后，使用本仓库副本或解压后的 npm 包，按下文操作应用宿主补丁，再将 Manager 安装到实际使用的 DSH profile：

```powershell
dsh plugin --profile web add @tingyu9527/dsh-workspace-manager@1.0.1-workspace-shell.1
```

使用与原 web 实例相同的 `DSH_HOME`，然后重启 DSH。安装包不会自动修改宿主；稳定版 `latest` 仍保持 `1.0.1`。

## 界面结构

```text
DSH 根布局（宿主保留注册及原生界面状态）
└─ page-app.shell 插槽
   └─ Workspace Manager
      ├─ 常驻最左导航（默认 166px，窄屏收缩）
      └─ 内容区
         ├─ 原生 DSH 完整界面（保持挂载）
         └─ 各已访问的受管页面（保持挂载）
```

切换页面只改变显隐，不再把侧栏盖在原生 DSH 上，也不再因返回 DSH 而卸载所有受管页面。禁用、卸载或失去授权的受管页面仍由 Controller 正常移除。知识库等条目来自实际安装的 Workspace App，本次没有附送一个新的知识库产品。

## 修改与使用说明

完整修改、宿主路径、备份位置、部署步骤和未验证项见 [本次改动说明](docs/2026-08-28-workspace-shell-changes.md)。

`src/client` 是本次客户端源码入口；`packages/ui-page-app-manager/src` 是构建脚本同步的历史目录镜像。`lib/client.js` 是已生成的客户端产物。已有 Host 管理器的 `lib/index.js` 等产物保留不变。

## 构建客户端

在已具备开发依赖的环境中：

```powershell
node scripts/build-client.mjs
```

也可复用已有工具链，无需下载或重装 DSH：

```powershell
node scripts/build-client.mjs --toolchain "<已有 DSH 源码工具链目录>"
```

构建只更新客户端及源码镜像，不执行完整类型检查、Host 重编译或验收测试。Remote 描述符快照位于 `src/client/generated`，沿用现有 Host 协议，没有伪造激活事件。

## RC2 宿主兼容补丁

以下目录参数是包含 `node_modules/@deepseek-ai/dsh` 的安装目录，不是 `DSH_HOME`：

```powershell
node scripts/patch-host.mjs status "<DSH 安装目录>"
node scripts/patch-host.mjs apply "<DSH 安装目录>"
node scripts/patch-host.mjs restore "<DSH 安装目录>"
```

补丁仅接受指定 RC2 版本和已核对的两个发行文件哈希；先备份再替换，不写穿 pnpm 的共享硬链接。补丁应用/恢复后需重启 DSH 并刷新浏览器。升级或重装 DSH 可能覆盖补丁，此时需要重新检查兼容性。

## 其他能力与限制

包保留原来的 Workspace App 安装、启停、隐藏、排序、卸载、事务回滚与 Workbench Contract。浏览器不执行包管理或写 profile 文件。Manager 缺席或外壳报错时，宿主提供低优先级原生界面回退；Manager 安装/移除时不保证 React 局部状态保持，普通页面切换才保持现有挂载节点。

本轮只做客户端构建、JavaScript 语法检查、组件级显隐/节点保留检查和补丁哈希核对；没有运行四层验收、完整回归、真实 Feature 安装或浏览器视觉验收。

[Workbench Contract v1](docs/workbench-contract-v1.md) · [MIT License](LICENSE)
