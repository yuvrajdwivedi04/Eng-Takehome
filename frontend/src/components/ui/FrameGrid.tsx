/**
 * FrameGrid
 * 
 * Architectural grid lines for the home page layout.
 * Renders 3 fixed lines:
 * 1. Left vertical (full height)
 * 2. Right vertical (full height)
 * 3. Top horizontal (full width, crossing the verticals)
 */
export function FrameGrid() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[5]" aria-hidden="true">
      {/* Left Vertical Line - Full Height */}
      <div className="absolute top-0 bottom-0 left-8 md:left-32 w-px bg-frame" />
      
      {/* Right Vertical Line - Full Height */}
      <div className="absolute top-0 bottom-0 right-8 md:right-32 w-px bg-frame" />
      
      {/* Top Horizontal Line - Full Width */}
      <div className="absolute left-0 right-0 top-16 h-px bg-frame" />
    </div>
  )
}
