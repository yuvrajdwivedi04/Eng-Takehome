/**
 * HeatmapGrid
 * 
 * Animated data visualization grid for the home page.
 * Technique: "Mosaic Grid" with V-shaped jagged top edge
 * Renders individual columns with varying top offsets to create teeth effect
 */
import React from "react"

export function HeatmapGrid() {
  // Grid dimensions
  const cols = 24
  const rows = 12

  // Generate V-shaped jagged offsets for each column (in percentage of container height)
  const jaggedOffsets = React.useMemo(() => {
    const offsets: number[] = []
    let i = 0
    
    while (i < cols) {
      // Random tooth width: 4-6 columns for wider V-shapes
      const toothWidth = Math.floor(Math.random() * 3) + 4 // 4, 5, or 6 columns
      
      // Random peak depth: how far down the V goes (8-20% of height)
      const peakDepth = Math.random() * 12 + 8 // 8-20%
      
      // Create V-shape across the tooth width
      const midPoint = (toothWidth - 1) / 2
      
      for (let j = 0; j < toothWidth && i < cols; j++) {
        // Calculate distance from the center (V peak)
        const distanceFromCenter = Math.abs(j - midPoint)
        
        // V-shape: deepest in middle, shallower toward edges
        const edgeDepth = peakDepth * 0.2 // Edges are 20% of peak depth
        const normalizedDistance = distanceFromCenter / midPoint
        const depth = peakDepth - (normalizedDistance * (peakDepth - edgeDepth))
        
        offsets[i] = depth
        i++
      }
    }
    
    return offsets
  }, [])

  return (
    <div className="fixed left-8 md:left-32 right-8 md:right-32 top-[55vh] bottom-0 overflow-hidden bg-dark z-0">
      <div className="relative w-full h-full flex">
        {Array.from({ length: cols }).map((_, colIndex) => {
          const topOffset = jaggedOffsets[colIndex]
          
          return (
            <div
              key={colIndex}
              className="flex-1 flex flex-col"
              style={{
                paddingTop: `${topOffset}%`
              }}
            >
              {Array.from({ length: rows }).map((_, rowIndex) => {
                // Calculate diagonal delay for wave animation
                const delay = -1 * (colIndex + rowIndex) * 0.2
                
                // Calculate opacity: fade toward top
                const opacity = 0.3 + (rowIndex / (rows - 1)) * 0.7
                
                return (
                  <div
                    key={rowIndex}
                    className="w-full flex-1 animate-color-cycle border-r border-b border-white/5"
                    style={{
                      animationDelay: `${delay}s`,
                      opacity: opacity
                    }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
