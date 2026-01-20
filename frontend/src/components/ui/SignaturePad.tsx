// Feature #832: Enhanced signature pad styling
import { useRef, useState, useEffect, useCallback } from 'react'
import { Eraser, Check, PenTool } from 'lucide-react'

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
  width?: number
  height?: number
  className?: string
  label?: string
  required?: boolean
}

export function SignaturePad({
  onChange,
  width = 400,
  height = 200,
  className = '',
  label = 'Signature',
  required = false
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    // Set up canvas for high-DPI displays
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.scale(dpr, dpr)

    // Set drawing styles - Feature #832: Enhanced pen appearance
    context.strokeStyle = '#1a1a2e' // Dark blue-black for professional look
    context.lineWidth = 2.5
    context.lineCap = 'round'
    context.lineJoin = 'round'

    // Fill with white background
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)

    // Draw signature line - Feature #832: Visual guide
    context.strokeStyle = '#e5e7eb'
    context.lineWidth = 1
    context.setLineDash([5, 5])
    context.beginPath()
    context.moveTo(20, height - 40)
    context.lineTo(width - 20, height - 40)
    context.stroke()
    context.setLineDash([])

    // Draw "X" marker for signature start
    context.fillStyle = '#9ca3af'
    context.font = '14px system-ui'
    context.fillText('×', 10, height - 35)

    // Reset stroke style for actual signature
    context.strokeStyle = '#1a1a2e'
    context.lineWidth = 2.5

    setCtx(context)
  }, [width, height])

  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()

    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      }
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }
  }, [])

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!ctx) return
    e.preventDefault()

    const { x, y } = getCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
    setHasSignature(true)
    setIsFocused(true)
  }, [ctx, getCoordinates])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !ctx) return
    e.preventDefault()

    const { x, y } = getCoordinates(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }, [isDrawing, ctx, getCoordinates])

  const stopDrawing = useCallback(() => {
    if (!ctx) return
    ctx.closePath()
    setIsDrawing(false)

    // Export signature as data URL
    const canvas = canvasRef.current
    if (canvas && hasSignature) {
      const dataUrl = canvas.toDataURL('image/png')
      onChange(dataUrl)
    }
  }, [ctx, hasSignature, onChange])

  const clearSignature = useCallback(() => {
    if (!ctx || !canvasRef.current) return

    // Redraw the canvas with guide line
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // Redraw signature line
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(20, height - 40)
    ctx.lineTo(width - 20, height - 40)
    ctx.stroke()
    ctx.setLineDash([])

    // Redraw "X" marker
    ctx.fillStyle = '#9ca3af'
    ctx.font = '14px system-ui'
    ctx.fillText('×', 10, height - 35)

    // Reset stroke style
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2.5

    setHasSignature(false)
    onChange(null)
  }, [ctx, width, height, onChange])

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Signature Pad Container - Feature #832: Enhanced styling */}
      <div
        className={`
          relative rounded-lg overflow-hidden
          transition-all duration-200 ease-in-out
          ${isFocused
            ? 'ring-2 ring-primary ring-offset-2 shadow-lg'
            : hasSignature
              ? 'ring-2 ring-green-500 ring-offset-1'
              : 'border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50'
          }
        `}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      >
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={() => {
            stopDrawing()
            setIsFocused(false)
          }}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair touch-none bg-white"
          style={{ width, height }}
        />

        {/* Placeholder - Feature #832: Improved placeholder styling */}
        {!hasSignature && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <PenTool className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <span className="text-sm text-muted-foreground/50 font-medium">
              Sign here
            </span>
            <span className="text-xs text-muted-foreground/30 mt-1">
              Use mouse or touch
            </span>
          </div>
        )}

        {/* Success indicator overlay */}
        {hasSignature && !isDrawing && (
          <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-sm">
            <Check className="h-3 w-3" />
          </div>
        )}
      </div>

      {/* Controls - Feature #832: Styled clear button */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {hasSignature ? (
            <span className="flex items-center gap-1.5 text-green-600 font-medium">
              <Check className="h-3.5 w-3.5" />
              Signature captured
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <PenTool className="h-3.5 w-3.5" />
              Draw your signature above
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={clearSignature}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
            transition-all duration-200
            ${hasSignature
              ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
              : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
            }
          `}
          disabled={!hasSignature}
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear Signature
        </button>
      </div>
    </div>
  )
}
