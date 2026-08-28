# Workspace Manager 外壳改造说明

日期：2026-08-28

预发布版本：`1.0.1-workspace-shell.1`（npm 标签 `next`，未完成完整验收）

## 1. 本次改到了哪里

路径约定：`<manager-root>` 是本包源码或解压目录，`<dsh-install>` 是包含 DSH 的 `node_modules` 的安装目录，`<dsh-home>` 是用户选择的 DSH 数据目录。文档不包含开发机器的个人绝对路径。

主要修改目录：

```text
<manager-root>
```

开发时仅在已存在的隔离 RC2 预览环境应用了宿主补丁，没有重新下载 DSH，也没有修改其他 DSH 安装或 Boujoy 项目。本仓库保留补丁工具，不包含整个 DSH 安装、运行 profile、账号配置或宿主备份。

这是“独立 Manager 包＋明确的宿主兼容补丁”方案，不是“零宿主改动”的纯插件方案。

## 2. 实现的界面结构

```text
DSH 原有根布局注册（保留布局 store、actions 和原生服务）
└─ WorkspaceRoot（宿主新增的薄包装）
   └─ page-app.shell 插槽
      ├─ 优先级 0：Workspace Manager 外壳
      │  ├─ PageAppRail：常驻最左侧导航
      │  └─ 内容区
      │     ├─ 原生 DSH AppFrame：完整会话栏、聊天区、详情区
      │     ├─ 已访问的知识库等受管页面
      │     └─ 其他已访问的受管页面
      └─ 优先级 100：NativeSurfaceFallback（Manager 不可用时回退）
```

DSH 宿主仍然负责创建原生 `AppFrame`，把完整 React 元素作为 `nativeSurface` 交给 Manager。Manager 不复制原生聊天逻辑，不新建 iframe，不移动既有 DOM，也不再往原生界面的 `shell.overlay` 叠加左栏。

左侧导航默认占 166 CSS 像素，内容区使用剩余宽度；920px 以下收缩为 132px，600px 以下收缩为 104px。导航长名称允许换行，并提供完整 title，避免原来 56px 侧栏将标签挤成省略号。

普通页面切换只改变外层 `section` 的 `hidden` 属性：

- 选择原生 DSH：显示整套原生界面，隐藏其他页面。
- 选择受管页面：隐藏整个原生 DSH 页面，显示选中页面；最左侧导航保持。
- 已访问且仍有资格显示的页面保持挂载；不再因返回 DSH 而移除整个受管内容容器。
- 页面被禁用、卸载或失去授权时，Controller 仍会正常移除它。

此处实现的是与 Boujoy 相同的“全局导航＋整页切换”结构，不是复制 Boujoy 的涂鸦皮肤。知识库条目仍来自实际安装并成功注册的 Workspace App；本次没有新增知识库应用、模拟数据或伪造安装成功状态。

## 3. Manager 功能代码修改

以下路径均相对于本文第 1 节的主要修改目录。

| 文件 | 修改内容 |
| --- | --- |
| `src/client/client/contracts.ts` | 声明 `page-app.shell` 插槽及 `nativeSurface: ReactNode` 参数。 |
| `src/client/client/rc2-shell.ts` | 将 RC2 注册位置从 `shell.overlay` 改为宿主新增的 `page-app.shell`，保留受管页面子插槽。 |
| `src/client/client/Rc2PageAppShell.tsx` | 移除叠加层及有条件挂载的 host，接收宿主原生页面并复用完整外壳。 |
| `src/client/client/PageAppShell.tsx` | 提取共用 `PageAppShellView`，统一原生页面与受管页面的常驻布局、显隐和失败页处理。 |
| `src/client/client/PageAppShell.module.css` | 用 Grid 真正预留导航列；内容区限制溢出，页面使用布局/绘制包含，收窄固定定位子元素的影响范围。 |
| `src/client/client/PageAppRail.module.css` | 左栏填满父容器预留列，增加最小尺寸约束、盒模型和长标签换行。 |
| `src/client/client/PageAppRail.tsx` | 导航按钮增加完整名称的 title。 |
| `src/client/client/apply.ts`、`index.ts` | 更新 RC2 接入说明与公共导出；原有 Controller、Remote 和 Workbench 实现保持。 |
| `src/client/generated/typert.remote-client.js` | 保存既有 Host 生成的 Remote 描述符快照，让独立目录可以构建；没有变更协议或绕过激活确认。 |

删除了不再使用的 `src/client/client/Rc2PageAppShell.module.css`，以及其 `packages/ui-page-app-manager/src/client` 镜像。两份都是开发中间版本的旧叠加层样式，不属于最终外壳实现；没有删除用户数据。

`packages/ui-page-app-manager/src` 是历史导出布局的源码镜像。构建脚本会从本目录的 `src/client` 同步它；本次不再通过修改另一个 DSH 源码工作树来间接生成 Manager。

## 4. DSH 宿主修改了哪些文件

### 4.1 根布局扩展

实际修改的绝对路径：

```text
<dsh-install>\node_modules\.pnpm\@deepseek-ai+dsh-client-ui-_0bfde656e86ed97e7658ff0b0dd1f438\node_modules\@deepseek-ai\dsh-client-ui-layout\lib\client.js
```

修改内容：

1. 在原有 `root` 注册中增加 `page-app.shell` 子插槽声明。
2. 原来直接渲染 `AppFrame` 的入口改为 `WorkspaceRoot`；原有 root 的 store、inject 和其他子插槽均保留。
3. `WorkspaceRoot` 创建原生 `AppFrame` 元素，将其传给外壳插槽。
4. 增加优先级 100 的 `NativeSurfaceFallback`。Manager 没安装、被移除或其插槽条目因渲染错误退出时，保留原生页面的回退候选。
5. 外壳回退注册跟随原来的布局 effect 释放，不引入独立 React root。

宿主包装函数的可读源文件在本包 `host-patches/rc2-root-wrapper.js`；对发行文件的精确修改规则在 `scripts/patch-host.mjs`。

### 4.2 Manager 事件转发

实际修改的绝对路径：

```text
<dsh-install>\node_modules\.pnpm\@deepseek-ai+dsh-api-remote_e8ba1d06159c48669c8f1c0216e0ac7e\node_modules\@deepseek-ai\dsh-api-remotes\lib\index.js
```

给 `API_REMOTE_FORWARDED_EVENTS` 增加：

```text
page-app-manager/changed
page-app-manager/activation-requested
```

目的是让浏览器能够收到 Manager 状态变化和激活请求。没有伪造事件、替浏览器提前确认激活，也没有扩大其他事件白名单。这里只完成了缺失转发的代码修正，不能将它当成真实 Feature 安装链已验证成功。

### 4.3 备份与回滚

宿主备份和记录位于：

```text
<dsh-install>\.workspace-manager-host-patch
```

`receipt.json` 记录原文件路径、备份文件名、修改前后 SHA-256、操作时间和版本。补丁只接受 `0.1.1-rc.2` 及已核对的发行文件哈希；遇到未知改动会停止。替换时写入新文件后重命名，避免写穿 pnpm 硬链接而改到共享包缓存或其他安装。

恢复宿主文件的命令（不卸载 Manager）：

```powershell
Set-Location '<manager-root>'
node scripts/patch-host.mjs restore '<dsh-install>'
```

恢复后需重启 DSH。新的 Manager 需要新增外壳插槽；恢复宿主之后它不会再显示新左栏，原生 DSH 仍由宿主显示。若要完整恢复本次之前的 Manager，安装此前的稳定版 Manager，并恢复宿主两个文件。

## 5. 构建、产物和其他维护修改

- `scripts/build-client.mjs`、`tsconfig.build.json`：直接构建当前目录的 TypeScript/TSX 与 CSS Modules，输出 DSH ModuleLoader 格式的 `lib/client.js`，并同步源码镜像。
- `lib/client.js`：已重新生成；`lib/types/client/index.d.ts` 增补新宿主插槽的类型声明。未改动的 Host Manager 编译产物保持原样，没有重新实现事务和安装后端。
- `scripts/patch-host.mjs`：提供 `status`、`apply`、`restore`，采用版本/哈希检查、备份和原子替换。
- `scripts/check-render.mjs`：仅用于已编译组件的基础渲染检查，不启动 DSH，不运行真实 API 或完整验收。
- `package.json`：增加构建/补丁命令和开发依赖，版本使用预发布标识 `1.0.1-workspace-shell.1`，通过 `next` 标签与稳定版 `1.0.1` 区分。
- 根目录与客户端包的中英文 README、CHANGELOG：更新为外壳方案，删除当前版本仍使用 overlay 的错误说明。
- `tests/client` 及 `packages/ui-page-app-manager/tests` 中的 `apply.client.spec.ts`、`shell.client.spec.tsx`、`rail-styles.client.spec.ts`、`rc2-shell-styles.client.spec.ts`：同步原有断言与夹具以反映新插槽和布局；本轮没有运行这些历史完整测试组。

可安装的本地打包产物位于本目录：

```text
artifacts\tingyu9527-dsh-workspace-manager-1.0.1-workspace-shell.1.tgz
```

## 6. 安装与运行状态

本次代码已在既有 DSH `0.1.1-rc.2` 预览环境安装并重启，首页 HTTP 返回 `200`，启动错误日志为空。这仅说明服务启动成功，不代表浏览器视觉验收或真实 Feature 链路通过。

在自己的环境中，停止 DSH 后执行以下步骤。请将路径占位符替换成实际目录，且保持与原实例相同的 `DSH_HOME`：

```powershell
$env:DSH_HOME = '<dsh-home>'
node '<manager-root>/scripts/patch-host.mjs' status '<dsh-install>'
node '<manager-root>/scripts/patch-host.mjs' apply '<dsh-install>'
dsh plugin --profile web add @tingyu9527/dsh-workspace-manager@1.0.1-workspace-shell.1
```

这里的 `<manager-root>` 是仓库副本或解压后的 npm 包目录。npm 安装本身不会自动打宿主补丁。随后使用原有启动方式重启 DSH 并刷新浏览器。DSH 后续升级或重装可能覆盖宿主补丁，应重新执行 `status` 核对，而不是假定一直兼容。

## 7. 已做的基础检查与明确未验证项

按你的要求，本轮不执行繁杂测试和四层验收。

已完成：

1. 从指定目录直接构建客户端成功。
2. 客户端产物、构建/补丁脚本、两个已修改宿主文件的 JavaScript 语法检查通过。
3. 在真实 React＋DOM 模拟环境中载入编译后的客户端工厂，检查共用外壳：一条常驻导航；原生页与插件页正确切换 `hidden`；两者节点在切换后保留；插件页输入内容保留。
4. 宿主补丁的原文件哈希、写入后哈希和 `status` 检查通过，两份备份已保留。

未完成，不宣称通过：

- 四层验收、完整回归、全项目 TypeScript 类型检查。
- 浏览器视觉/响应式验收（仅已确认真实 DSH 的进程启动与 HTTP 响应）。
- 真实 Workspace Feature 的安装、激活、禁用、卸载及失败恢复链。
- 新宿主插槽与真实渲染器的完整生命周期、崩溃回退、热重载验收。
- 页面渲染到 `document.body` 的外部 Portal、全局快捷键在隐藏页面时的交互隔离；本轮只控制页面自身的 DOM 子树，没有改造每个原生弹窗或全局事件监听器。
- 浏览器刷新后的页面选择恢复、Manager 自身安装/移除期间的 React 局部状态保留。普通页面切换保留挂载节点，不等于这些场景也保持全部状态。

本次交付状态：**功能代码、编译包与可回滚的宿主补丁已完成，预览环境已安装并启动；完整验收仍未完成。**
