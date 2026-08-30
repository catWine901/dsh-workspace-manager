import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import {
  clampWidth, computeNativeDshColumns, DETAILS_DEFAULT, DETAILS_MAX, DETAILS_MIN,
  SIDEBAR_AUTO_COLLAPSE, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN,
} from './layout.ts'
import css from './Rc2NativeDshSurface.module.css'

type LayoutState = { sidebar: number; details: number; narrow: boolean; narrowExpanded: boolean }
type LayoutActions = {
  setSidebar: (draft: LayoutState, px: number) => void
  setDetails: (draft: LayoutState, px: number) => void
  toggleSidebar: (draft: LayoutState) => void
  setNarrow: (draft: LayoutState, narrow: boolean) => void
  openDetails: (draft: LayoutState) => void
  closeDetails: (draft: LayoutState) => void
}

export function createRc2LayoutStore(): EngineStoreHandle<LayoutState, LayoutActions> {
  return defineStore({
    init: (): LayoutState => ({ sidebar: SIDEBAR_DEFAULT, details: 0, narrow: false, narrowExpanded: false }),
    actions: {
      setSidebar: (draft, px: number) => { draft.sidebar = clampWidth(px, SIDEBAR_MIN, SIDEBAR_MAX) },
      setDetails: (draft, px: number) => { draft.details = clampWidth(px, DETAILS_MIN, DETAILS_MAX) },
      toggleSidebar: (draft) => {
        if (draft.narrow) draft.narrowExpanded = !draft.narrowExpanded
        else draft.sidebar = draft.sidebar === 0 ? SIDEBAR_DEFAULT : 0
      },
      setNarrow: (draft, narrow: boolean) => {
        if (draft.narrow === narrow) return
        draft.narrow = narrow
        draft.narrowExpanded = false
      },
      openDetails: (draft) => { if (draft.details === 0) draft.details = DETAILS_DEFAULT },
      closeDetails: (draft) => { draft.details = 0 },
    },
  })
}

export type Rc2NativeDshSurfaceProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay'>
  & PropsStore<ReturnType<typeof createRc2LayoutStore>>

function DragHandle(props: { side: 'sidebar' | 'details'; left: number; onStart: () => void; onDrag: (dx: number) => void; onEnd: () => void }) {
  const [dragging, setDragging] = useState(false)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)
  const callbacks = useRef({ onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd })
  callbacks.current = { onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd }
  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
    origin.current = event.clientX; latest.current = event.clientX; callbacks.current.onStart(); setDragging(true)
  }, [])
  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    latest.current = event.clientX
    frame.current ??= requestAnimationFrame(() => { frame.current = null; callbacks.current.onDrag(latest.current - origin.current) })
  }, [])
  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null }
    callbacks.current.onDrag(latest.current - origin.current); setDragging(false); callbacks.current.onEnd()
  }, [])
  return <div className={css.handle} style={{ left: props.left }} data-side={props.side} data-dragging={dragging || undefined} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
}

function Column(props: { className: string; children?: ReactNode }) { return <div className={props.className}>{props.children}</div> }

/** Version-locked reconstruction of the native RC2 AppFrame around the original DSH slots. */
export function Rc2NativeDshSurface({ useStore, useSessions, actions, renderSlot }: Rc2NativeDshSurfaceProps) {
  const panels = useStore(state => state)
  const detailsSession = useSessions(state => {
    const current = state.current
    return current !== undefined && state.byId[current]?.blank === false ? current : undefined
  })
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState(() => window.innerWidth)
  const lastSession = useRef(detailsSession)
  useLayoutEffect(() => {
    if (detailsSession === undefined) return
    if (lastSession.current !== undefined && lastSession.current !== detailsSession) actions.closeDetails()
    lastSession.current = detailsSession
  }, [actions, detailsSession])
  useEffect(() => {
    const element = frameRef.current
    if (element === null) return
    let animation: number | null = null
    const observer = new ResizeObserver(() => {
      animation ??= requestAnimationFrame(() => {
        animation = null
        const width = element.getBoundingClientRect().width
        if (width > 0) setViewport(width)
      })
    })
    observer.observe(element)
    return () => { observer.disconnect(); if (animation !== null) cancelAnimationFrame(animation) }
  }, [])
  const narrow = viewport < SIDEBAR_AUTO_COLLAPSE
  useEffect(() => { actions.setNarrow(narrow) }, [actions, narrow])
  const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0
  const sidebarPreference = sidebarCollapsed ? 0 : panels.sidebar === 0 ? SIDEBAR_DEFAULT : panels.sidebar
  const columns = computeNativeDshColumns(viewport, sidebarPreference, detailsSession === undefined ? 0 : panels.details)
  const columnsRef = useRef(columns); columnsRef.current = columns
  const sidebarBase = useRef(0); const detailsBase = useRef(0)
  const [dragging, setDragging] = useState(false)
  const end = useCallback(() => { setDragging(false) }, [])
  const sidebarStart = useCallback(() => { sidebarBase.current = columnsRef.current.sidebar; setDragging(true) }, [])
  const detailsStart = useCallback(() => { detailsBase.current = columnsRef.current.details; setDragging(true) }, [])
  const sidebarDrag = useCallback((dx: number) => { actions.setSidebar(sidebarBase.current + dx) }, [actions])
  const detailsDrag = useCallback((dx: number) => { actions.setDetails(detailsBase.current - dx) }, [actions])
  return (
    <div ref={frameRef} className={css.frame} style={{ gridTemplateColumns: `${columns.sidebar}px minmax(0, 1fr) ${columns.details}px` }} data-sidebar-collapsed={sidebarCollapsed || undefined} data-details-collapsed={columns.details === 0 || undefined} data-dragging={dragging || undefined}>
      <Column className={css.sidebarCol}>{renderSlot('sidebar', { collapsed: sidebarCollapsed, width: columns.sidebar })}</Column>
      <Column className={css.centerCol}>{renderSlot('conversation', {})}</Column>
      <Column className={css.detailsCol}>{renderSlot('details', {})}</Column>
      <div className={css.overlayLayer} data-shell-overlay>{renderSlot('shell.overlay', {})}</div>
      {!sidebarCollapsed && <DragHandle side="sidebar" left={columns.sidebar} onStart={sidebarStart} onDrag={sidebarDrag} onEnd={end} />}
      {columns.details > 0 && <DragHandle side="details" left={viewport - columns.details} onStart={detailsStart} onDrag={detailsDrag} onEnd={end} />}
    </div>
  )
}
