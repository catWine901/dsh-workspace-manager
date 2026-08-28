/**
 * Client page-app manager package entry: the React-free controller, its bare
 * observable store, the client-safe contracts, and the Native keep-mounted
 * shell or build-selected rc2 wrapper registration. Native owns the root
 * handoff plus builtin/surface child seats; patched RC2 supplies the original
 * AppFrame through the `page-app.shell` owner props. The shell
 * constructs the controller with the real remote, slot ledger, and graph
 * convergence seams; nothing here imports React directly (the shell
 * components do, through the slot renderer's inject.hooks compartment).
 * @module @deepseek-ai/dsh-client-ui-page-app-manager/client
 */

export * from './controller.ts'
export * from './stores.ts'
export * from './contracts.ts'
export * from './workbench.ts'
export * from './apply.ts'
export { PageAppShell, type PageAppShellInjected, type PageAppShellProps } from './PageAppShell.tsx'
export * from './PageAppRail.tsx'
export * from './PageAppSettingsTab.tsx'
export * from './locales.ts'
