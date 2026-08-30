export const CENTER_MIN = 640
export const SIDEBAR_MIN = 264
export const SIDEBAR_MAX = 420
export const SIDEBAR_DEFAULT = 280
export const SIDEBAR_COLLAPSED = 56
export const SIDEBAR_AUTO_COLLAPSE = 1024
export const DETAILS_MIN = 300
export const DETAILS_MAX = 520
export const DETAILS_DEFAULT = 360

export interface NativeDshColumns { sidebar: number; center: number; details: number }

export function clampWidth(px: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, px))
}

/** Exact 0.1.1-rc.2 concession chain, isolated in its version adapter. */
export function computeNativeDshColumns(viewport: number, sidebar: number, details: number): NativeDshColumns {
  const resolvedSidebar = sidebar === 0 ? SIDEBAR_COLLAPSED : clampWidth(sidebar, SIDEBAR_MIN, SIDEBAR_MAX)
  let resolvedDetails = details === 0 ? 0 : clampWidth(details, DETAILS_MIN, DETAILS_MAX)
  if (viewport - resolvedSidebar - resolvedDetails < CENTER_MIN) {
    resolvedDetails = Math.max(0, viewport - resolvedSidebar - CENTER_MIN)
    if (resolvedDetails < DETAILS_MIN) resolvedDetails = 0
  }
  return { sidebar: resolvedSidebar, center: Math.max(0, viewport - resolvedSidebar - resolvedDetails), details: resolvedDetails }
}
