/**
 * The permanent far-left Workspace App rail (spec §2/§20): DSH / Agent plus
 * every eligible managed page, in stable registry order. A row appears only
 * when the shell's closed projection reports it eligible (registry ownership +
 * enabled + runtime registration; the shell also filters hidden). Accessible
 * current-page state via aria-current, roving-tabindex keyboard navigation,
 * and stable labels/ordering. Pure component: rows, active id, and the select
 * callback arrive from the shell.
 * @module @deepseek-ai/dsh-client-ui-page-app-manager/client/PageAppRail
 */
/** One rail row projected by the shell from the controller snapshot. */
export interface PageAppRailRow {
    /** Managed page id. */
    readonly pageId: string;
    /** Display label (the manifest page name). */
    readonly label: string;
    /** Registry order (ascending). */
    readonly order: number;
}
/** Injected props the shell hands to the rail. */
export interface PageAppRailInjected {
    /** Ordered eligible rows (DSH/Agent is always rendered first, not a row). */
    readonly rows: readonly PageAppRailRow[];
    /** Active page id, or null when the built-in DSH page is active. */
    readonly activePageId: string | null;
    /** Select one page (null = built-in DSH). */
    readonly select: (pageId: string | null) => void;
}
/** The permanent far-left launcher (see module doc). */
export declare function PageAppRail({ rows, activePageId, select }: PageAppRailInjected): import("react").JSX.Element;
//# sourceMappingURL=PageAppRail.d.ts.map