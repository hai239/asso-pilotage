"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface SplitPaneProps {
  left: React.ReactNode
  right: React.ReactNode
  defaultLeftPct?: number
  minLeftPct?: number
  minRightPct?: number
}

export default function SplitPane({
  left,
  right,
  defaultLeftPct = 70,
  minLeftPct = 40,
  minRightPct = 20,
}: SplitPaneProps) {
  const [leftPct, setLeftPct] = useState(defaultLeftPct)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const maxLeftPct = 100 - minRightPct

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setLeftPct(Math.min(maxLeftPct, Math.max(minLeftPct, pct)))
    },
    [maxLeftPct, minLeftPct]
  )

  const onMouseUp = useCallback(() => {
    dragging.current = false
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }, [])

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  function onMouseDown() {
    dragging.current = true
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 w-full">
      <div className="h-full overflow-y-auto" style={{ width: `${leftPct}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionner les panneaux"
        onMouseDown={onMouseDown}
        className="w-1.5 shrink-0 cursor-col-resize bg-border hover:bg-rapports transition-colors"
      />
      <div className="h-full overflow-y-auto" style={{ width: `${100 - leftPct}%` }}>
        {right}
      </div>
    </div>
  )
}
