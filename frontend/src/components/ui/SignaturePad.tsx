import { useRef, useState, useEffect, useCallback } from 'react'
import { Eraser, Check, X } from 'lucide-react'

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
  width?: number
  height?: number
  className?: string
}

export function SignaturePad({
  onChange,
  width = 400,
  height = 200,
  className = ''
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)

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

    // Set drawing styles
    context.strokeStyle = '#000'
    context.lineWidth = 2
    context.lineCap = 'round'
    context.lineJoin = 'round'

    // Fill with white background
    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, height)

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
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    setHasSignature(false)
    onChange(null)
  }, [ctx, width, height, onChange])

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative border-2 border-dashed rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair touch-none"
          style={{ width, height }}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground/50">
            <span className="text-sm">Sign here</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {hasSignature ? (
            <span className="flex items-center gap-1 text-green-600">
              <Check className="h-3 w-3" />
              Signature captured
            </span>
          ) : (
            'Draw your signature above'
          )}
        </span>
        <button
          type="button"
          onClick={clearSignature}
          className="flex items-center gap-1 px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
          disabled={!hasSignature}
        >
          <Eraser className="h-3 w-3" />
          Clear
        </button>
      </div>
    </div>
  )
}
