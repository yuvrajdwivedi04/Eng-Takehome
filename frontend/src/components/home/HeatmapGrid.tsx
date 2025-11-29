/**
 * HeatmapGrid
 * 
 * Animated data visualization grid for the home page.
 * Technique: "Mosaic Grid"
 * Renders individual cells with staggered animation delays to create a diagonal wave of distinct colors.
 */
export function HeatmapGrid() {
  // Grid dimensions - adjusted to fill the viewport width/height
  const cols = 24
  const rows = 12

  return (
    <div className="fixed left-8 md:left-32 right-8 md:right-32 top-[55vh] bottom-0 overflow-hidden bg-dark border-t border-white/10">
      <div 
        className="w-full h-full grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`
        }}
      >
        {Array.from({ length: cols * rows }).map((_, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          
          // Calculate diagonal delay: (col + row) creates a diagonal wave front
          // Negative delay ensures animation is already running (no startup lag)
          const delay = -1 * (col + row) * 0.2

          return (
            <div
              key={i}
              className="w-full h-full animate-color-cycle border-r border-b border-white/5"
              style={{
                animationDelay: `${delay}s`
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
