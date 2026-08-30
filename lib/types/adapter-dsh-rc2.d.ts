import type { Context } from '@deepseek-ai/cordis';
import type { WorkspaceHostDescriptor } from './host-bridge.js';

/** Exact adapter identity installed ahead of Workspace Manager in the bundle. */
export declare const RC2_HOST_ADAPTER_ENTRY_ID = "workspace-manager-dsh-host-adapter";
/** Auditable host capabilities consumed through WorkspaceHostBridge v1. */
export declare const RC2_HOST_DESCRIPTOR: WorkspaceHostDescriptor;
/** Provide RC2 profile lifecycle and Host Adapter services to Workspace Manager. */
export declare function apply(ctx: Context): void;
