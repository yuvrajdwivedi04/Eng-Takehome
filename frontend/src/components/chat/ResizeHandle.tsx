import { useRef, useCallback } from "react"

interface ResizeHandleProps {
  onResize: (deltaX: number) => void
}

export function ResizeHandle({ onResize }: ResizeHandleProps) {
  const previousX = useRef(0)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    previousX.current = e.clientX
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault()
      const deltaX = previousX.current - moveEvent.clientX
      previousX.current = moveEvent.clientX
      onResize(deltaX)
    }

    const handlePointerUp = () => {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      document.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("pointerup", handlePointerUp)
    }

    document.addEventListener("pointermove", handlePointerMove)
    document.addEventListener("pointerup", handlePointerUp)
  }, [onResize])

  return (
    <div
      onPointerDown={handlePointerDown}
      className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
    >
      <div className="absolute left-0 top-0 bottom-0 w-8 -translate-x-1/2" />
    </div>
  )
}
