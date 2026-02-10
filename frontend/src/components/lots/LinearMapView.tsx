// Feature #151 - Linear Map Visualization for Lots
import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, ExternalLink, Printer, Download } from 'lucide-react'

interface Lot {
  id: string
  lotNumber: string
  description: string | null
  status: string
  activityType?: string | null
  chainageStart: number | null
  chainageEnd: number | null
  layer: string | null
  areaZone: string | null
}

// Feature #708 - Project Area for background highlighting
interface ProjectArea {
  id: string
  name: string
  chainageStart: number | null
  chainageEnd: number | null
  colour: string | null
}

interface LinearMapViewProps {
  lots: Lot[]
  onLotClick: (lot: Lot) => void
  statusColors: Record<string, string>
  areas?: ProjectArea[]  // Feature #708 - Optional areas for background highlighting
}

// Feature #153 - Popup state
interface PopupState {
  lot: Lot
  x: number
  y: number
}

// Get color based on lot status
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    active: '#3b82f6',      // blue-500
    in_progress: '#f59e0b', // amber-500
    completed: '#22c55e',   // green-500
    approved: '#10b981',    // emerald-500
    on_hold: '#ef4444',     // red-500
    cancelled: '#6b7280',   // gray-500
    pending: '#8b5cf6',     // violet-500
  }
  return colors[status] || '#9ca3af' // gray-400 default
}

// Get activity type color
const getActivityColor = (activityType: string | null) => {
  const colors: Record<string, string> = {
    Earthworks: '#8b5cf6',    // violet
    Drainage: '#3b82f6',      // blue
    Pavement: '#6b7280',      // gray
    Concrete: '#78716c',      // stone
    Structures: '#f59e0b',    // amber
    General: '#10b981',       // emerald
    Landscaping: '#22c55e',   // green
    Utilities: '#ef4444',     // red
    Fencing: '#f97316',       // orange
    Signage: '#ec4899',       // pink
  }
  return colors[activityType || ''] || '#9ca3af'
}

export function LinearMapView({ lots, onLotClick, statusColors: _statusColors, areas = [] }: LinearMapViewProps) {
  // Note: _statusColors is received from props but we use the local getStatusColor function instead
  void _statusColors
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState(0)

  // Feature #153 - Popup state for lot click
  const [popup, setPopup] = useState<PopupState | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Feature #155 - Map container ref for print/export
  const mapContainerRef = useRef<HTMLDivElement>(null)

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null)
      }
    }
    if (popup) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [popup])

  // Calculate chainage range and scale
  const { minChainage, maxChainage, totalRange, layers } = useMemo(() => {
    const lotsWithCh = lots.filter(l => l.chainageStart !== null || l.chainageEnd !== null)

    if (lotsWithCh.length === 0) {
      return { minChainage: 0, maxChainage: 1000, totalRange: 1000, layers: [] }
    }

    const chainageValues = lotsWithCh.flatMap(l => [l.chainageStart, l.chainageEnd].filter(v => v !== null) as number[])
    const min = Math.min(...chainageValues)
    const max = Math.max(...chainageValues)
    const range = max - min || 1000 // Avoid division by zero

    // Group lots by layer/activity type for rows
    const layerMap = new Map<string, Lot[]>()
    lotsWithCh.forEach(lot => {
      const layerKey = lot.activityType || lot.layer || 'Uncategorized'
      if (!layerMap.has(layerKey)) {
        layerMap.set(layerKey, [])
      }
      layerMap.get(layerKey)!.push(lot)
    })

    return {
      minChainage: min,
      maxChainage: max,
      totalRange: range,
      layers: Array.from(layerMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    }
  }, [lots])

  // Calculate chainage tick marks
  const chainageTicks = useMemo(() => {
    const tickCount = 10
    const interval = totalRange / tickCount
    const roundedInterval = Math.ceil(interval / 100) * 100 || 100 // Round to nearest 100
    const ticks: number[] = []
    const startTick = Math.floor(minChainage / roundedInterval) * roundedInterval
    for (let i = startTick; i <= maxChainage + roundedInterval; i += roundedInterval) {
      ticks.push(i)
    }
    return ticks
  }, [minChainage, maxChainage, totalRange])

  // Convert chainage to x position (percentage)
  const chainageToX = (chainage: number) => {
    return ((chainage - minChainage) / totalRange) * 100 * zoomLevel - panOffset
  }

  // Handle zoom
  const handleZoomIn = () => setZoomLevel(Math.min(zoomLevel + 0.5, 5))
  const handleZoomOut = () => setZoomLevel(Math.max(zoomLevel - 0.5, 1))
  const handlePanLeft = () => setPanOffset(Math.max(panOffset - 20, 0))
  const handlePanRight = () => setPanOffset(Math.min(panOffset + 20, (zoomLevel - 1) * 100))

  // Feature #155 - Print handler
  const handlePrint = useCallback(() => {
    setPopup(null) // Close any open popup first
    window.print()
  }, [])

  // Feature #155 - Export as PNG handler
  const handleExport = useCallback(async () => {
    setPopup(null) // Close any open popup first

    if (!mapContainerRef.current) return

    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(mapContainerRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      })

      const link = document.createElement('a')
      link.download = `linear-map-${new Date().toISOString().split('T')[0]}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.warn('Export failed, falling back to print:', error)
      window.print()
    }
  }, [])

  const ROW_HEIGHT = 48
  const HEADER_HEIGHT = 40
  const LABEL_WIDTH = 140

  return (
    <div className="bg-background">
      {/* Controls */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Linear Map</span>
          <span className="text-xs text-muted-foreground">
            Chainage: {minChainage.toLocaleString()} - {maxChainage.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePanLeft}
            disabled={panOffset === 0}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
            title="Pan left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground px-2">{Math.round(zoomLevel * 100)}%</span>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 5}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handlePanRight}
            disabled={panOffset >= (zoomLevel - 1) * 100}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
            title="Pan right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {/* Feature #155 - Print/Export buttons */}
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={handlePrint}
            className="p-1.5 rounded hover:bg-muted"
            title="Print map"
            data-testid="linear-map-print"
          >
            <Printer className="h-4 w-4" />
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 rounded hover:bg-muted"
            title="Download as PNG"
            data-testid="linear-map-export"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Map Container - Feature #155: ref for print/export */}
      <div ref={mapContainerRef} className="relative overflow-x-auto" style={{ minHeight: HEADER_HEIGHT + layers.length * ROW_HEIGHT + 20 }}>
        {/* Chainage Axis (Header) */}
        <div
          className="sticky top-0 z-20 bg-muted/50 border-b"
          style={{ height: HEADER_HEIGHT, marginLeft: LABEL_WIDTH }}
        >
          <div className="relative h-full" data-testid="chainage-axis">
            {chainageTicks.map((tick, idx) => {
              const x = chainageToX(tick)
              if (x < 0 || x > 100 * zoomLevel) return null
              return (
                <div
                  key={idx}
                  className="absolute top-0 h-full flex flex-col items-center"
                  style={{ left: `${x}%` }}
                >
                  <div className="h-2 w-px bg-border" />
                  <span className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">
                    {tick.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Layers (Rows) */}
        <div className="relative" data-testid="layer-rows">
          {layers.map(([layerName, layerLots]) => (
            <div
              key={layerName}
              className="flex border-b last:border-b-0"
              style={{ height: ROW_HEIGHT }}
            >
              {/* Layer Label */}
              <div
                className="flex-shrink-0 flex items-center px-3 bg-muted/20 border-r font-medium text-sm truncate"
                style={{ width: LABEL_WIDTH }}
                title={layerName}
                data-testid={`layer-label-${layerName}`}
              >
                <span
                  className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: getActivityColor(layerName) }}
                />
                {layerName}
              </div>

              {/* Lot Blocks */}
              <div className="flex-1 relative" data-testid={`layer-content-${layerName}`}>
                {/* Feature #708 - Area background highlighting */}
                {areas.filter(area => area.chainageStart !== null && area.chainageEnd !== null && area.colour).map((area) => {
                  const areaStart = area.chainageStart!
                  const areaEnd = area.chainageEnd!
                  const left = chainageToX(Math.min(areaStart, areaEnd))
                  const right = chainageToX(Math.max(areaStart, areaEnd))
                  const width = right - left

                  if (left > 100 * zoomLevel || right < 0 || width <= 0) return null

                  return (
                    <div
                      key={`area-${area.id}`}
                      className="absolute top-0 h-full opacity-20"
                      style={{
                        left: `${Math.max(left, 0)}%`,
                        width: `${Math.min(width, 100 * zoomLevel - Math.max(left, 0))}%`,
                        backgroundColor: area.colour || undefined,
                      }}
                      title={`Area: ${area.name}`}
                      data-testid={`area-highlight-${area.id}`}
                    />
                  )
                })}

                {/* Grid lines */}
                {chainageTicks.map((tick, idx) => {
                  const x = chainageToX(tick)
                  if (x < 0 || x > 100 * zoomLevel) return null
                  return (
                    <div
                      key={idx}
                      className="absolute top-0 h-full w-px bg-border/30"
                      style={{ left: `${x}%` }}
                    />
                  )
                })}

                {/* Lots as colored blocks */}
                {layerLots.map((lot) => {
                  const start = lot.chainageStart ?? lot.chainageEnd ?? 0
                  const end = lot.chainageEnd ?? lot.chainageStart ?? 0
                  const left = chainageToX(Math.min(start, end))
                  const right = chainageToX(Math.max(start, end))
                  const width = Math.max(right - left, 0.5) // Minimum width for visibility

                  if (left > 100 * zoomLevel || right < 0) return null

                  return (
                    <div
                      key={lot.id}
                      className="absolute top-1 bottom-1 rounded cursor-pointer hover:ring-2 hover:ring-primary transition-all group"
                      style={{
                        left: `${Math.max(left, 0)}%`,
                        width: `${width}%`,
                        backgroundColor: getStatusColor(lot.status),
                        minWidth: 16,
                      }}
                      onClick={(e) => {
                        // Feature #153 - Show popup on click
                        const rect = e.currentTarget.getBoundingClientRect()
                        setPopup({
                          lot,
                          x: rect.left + rect.width / 2,
                          y: rect.top
                        })
                      }}
                      title={`${lot.lotNumber}: ${lot.description || 'No description'}\nChainage: ${start}-${end}\nStatus: ${lot.status}`}
                      data-testid={`lot-block-${lot.id}`}
                    >
                      {/* Lot label (shown on hover or if wide enough) */}
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden px-1">
                        <span className="text-[10px] text-white font-medium truncate drop-shadow-sm">
                          {lot.lotNumber}
                        </span>
                      </div>

                      {/* Tooltip on hover (only when popup not shown) */}
                      {!popup && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-30">
                          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                            <div className="font-medium">{lot.lotNumber}</div>
                            <div className="text-gray-300">{lot.description || 'No description'}</div>
                            <div className="text-gray-400">Ch. {start.toLocaleString()} - {end.toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 p-3 border-t bg-muted/20 text-xs">
        <span className="font-medium">Status:</span>
        {Object.entries({
          active: 'Active',
          in_progress: 'In Progress',
          completed: 'Completed',
          approved: 'Approved',
          on_hold: 'On Hold',
        }).map(([status, label]) => (
          <div key={status} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: getStatusColor(status) }}
            />
            <span>{label}</span>
          </div>
        ))}

        {/* Feature #708 - Areas legend */}
        {areas.filter(a => a.colour).length > 0 && (
          <>
            <div className="w-px h-4 bg-border mx-2" />
            <span className="font-medium">Areas:</span>
            {areas.filter(a => a.colour).map(area => (
              <div key={area.id} className="flex items-center gap-1" data-testid={`area-legend-${area.id}`}>
                <div
                  className="w-3 h-3 rounded opacity-50"
                  style={{ backgroundColor: area.colour || '#9ca3af' }}
                />
                <span>{area.name}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Feature #153 - Lot Popup */}
      {popup && (
        <div
          ref={popupRef}
          className="fixed z-50 bg-background border rounded-lg shadow-xl p-4 min-w-[280px]"
          style={{
            left: Math.min(popup.x, window.innerWidth - 300),
            top: Math.max(popup.y - 10, 10),
            transform: 'translate(-50%, -100%)'
          }}
          data-testid="lot-popup"
        >
          {/* Close button */}
          <button
            onClick={() => setPopup(null)}
            className="absolute top-2 right-2 p-1 rounded hover:bg-muted"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Lot info */}
          <div className="pr-6">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: getStatusColor(popup.lot.status) }}
              />
              <h3 className="font-semibold text-lg">{popup.lot.lotNumber}</h3>
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              {popup.lot.description || 'No description'}
            </p>

            <div className="space-y-1 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chainage:</span>
                <span className="font-medium">
                  {(popup.lot.chainageStart ?? 0).toLocaleString()} - {(popup.lot.chainageEnd ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium capitalize">{popup.lot.status.replace('_', ' ')}</span>
              </div>
              {popup.lot.activityType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Activity:</span>
                  <span className="font-medium">{popup.lot.activityType}</span>
                </div>
              )}
              {popup.lot.layer && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Layer:</span>
                  <span className="font-medium">{popup.lot.layer}</span>
                </div>
              )}
              {popup.lot.areaZone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Area/Zone:</span>
                  <span className="font-medium">{popup.lot.areaZone}</span>
                </div>
              )}
            </div>

            {/* View Details button */}
            <button
              onClick={() => {
                onLotClick(popup.lot)
                setPopup(null)
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              data-testid="lot-popup-view-details"
            >
              <ExternalLink className="h-4 w-4" />
              View Details
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
