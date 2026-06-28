// Feature #832: Enhanced signature pad styling
import { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser, Check, PenTool } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
  className?: string;
  label?: string;
  required?: boolean;
  /**
   * When true the canvas stretches to 100% of its container width rather than
   * using the fixed `width` prop.  Pass this inside a bottom-sheet so the
   * signature area fills the full mobile viewport width.
   *
   * The container div also calls `stopPropagation` on `pointerdown` so that a
   * signing stroke never triggers the BottomSheet's drag-to-dismiss logic
   * (the sheet starts a drag when the inner scroller is at scrollTop===0 and
   * it receives an unhandled pointerdown — stopping propagation here is the
   * robust guard).
   */
  fullWidth?: boolean;
  /**
   * Minimum canvas height in pixels when fullWidth=true.
   * Defaults to 160 (≥ one comfortable on-site finger stroke).
   */
  mobileHeight?: number;
}

export function SignaturePad({
  onChange,
  width = 400,
  height = 200,
  className = '',
  label = 'Signature',
  required = false,
  fullWidth = false,
  mobileHeight = 160,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const hasSignatureRef = useRef(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Resolved height — used for inline style on the canvas element.
  // Width is handled by fullWidth ? '100%' : fixed pixels; no JS needed.
  const resolvedHeight = fullWidth ? Math.max(mobileHeight, height) : height;

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // In fullWidth mode measure the actual container width.
    const drawWidth = fullWidth ? (containerRef.current?.clientWidth ?? width) : width;
    const drawHeight = fullWidth ? Math.max(mobileHeight, height) : height;

    // Set up canvas for high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = drawWidth * dpr;
    canvas.height = drawHeight * dpr;
    canvas.style.width = fullWidth ? '100%' : `${drawWidth}px`;
    canvas.style.height = `${drawHeight}px`;
    context.scale(dpr, dpr);

    // Set drawing styles - Feature #832: Enhanced pen appearance
    context.strokeStyle = '#1a1a2e'; // Dark blue-black for professional look
    context.lineWidth = 2.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    // Fill with white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, drawWidth, drawHeight);

    // Draw signature line - Feature #832: Visual guide
    context.strokeStyle = '#e5e7eb';
    context.lineWidth = 1;
    context.setLineDash([5, 5]);
    context.beginPath();
    context.moveTo(20, drawHeight - 40);
    context.lineTo(drawWidth - 20, drawHeight - 40);
    context.stroke();
    context.setLineDash([]);

    // Draw "X" marker for signature start
    context.fillStyle = '#9ca3af';
    context.font = '14px system-ui';
    context.fillText('×', 10, drawHeight - 35);

    // Reset stroke style for actual signature
    context.strokeStyle = '#1a1a2e';
    context.lineWidth = 2.5;

    setCtx(context);
  }, [width, height, fullWidth, mobileHeight]);

  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  }, []);

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!ctx) return;
      e.preventDefault();

      const { x, y } = getCoordinates(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
      hasSignatureRef.current = true;
      setHasSignature(true);
      setIsFocused(true);
    },
    [ctx, getCoordinates],
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !ctx) return;
      e.preventDefault();

      const { x, y } = getCoordinates(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing, ctx, getCoordinates],
  );

  const stopDrawing = useCallback(() => {
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);

    // Export signature as data URL
    const canvas = canvasRef.current;
    if (canvas && hasSignatureRef.current) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  }, [ctx, onChange]);

  const clearSignature = useCallback(() => {
    if (!ctx || !canvasRef.current) return;

    const drawWidth = fullWidth ? (containerRef.current?.clientWidth ?? width) : width;
    const drawHeight = fullWidth ? Math.max(mobileHeight, height) : height;

    // Redraw the canvas with guide line
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, drawWidth, drawHeight);

    // Redraw signature line
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(20, drawHeight - 40);
    ctx.lineTo(drawWidth - 20, drawHeight - 40);
    ctx.stroke();
    ctx.setLineDash([]);

    // Redraw "X" marker
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px system-ui';
    ctx.fillText('×', 10, drawHeight - 35);

    // Reset stroke style
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;

    hasSignatureRef.current = false;
    setHasSignature(false);
    onChange(null);
  }, [ctx, width, height, fullWidth, mobileHeight, onChange]);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      {/*
       * Outer wrapper carries the containerRef so the canvas init effect can
       * measure clientWidth in fullWidth mode.
       *
       * When fullWidth=true we also stop pointer events from bubbling out of
       * the canvas area.  This prevents a signing stroke from reaching the
       * BottomSheet's panel-level onPointerDown handler, which would otherwise
       * start a drag-to-dismiss gesture whenever the inner scroller is at
       * scrollTop===0 (the vaul/shouldDrag condition).  Stopping propagation
       * here is the robust guard regardless of scroll state.
       */}
      <div
        ref={containerRef}
        className={cn('w-full', fullWidth && 'touch-none')}
        style={fullWidth ? { touchAction: 'none' } : undefined}
        onPointerDown={fullWidth ? (e) => e.stopPropagation() : undefined}
        data-testid="signature-pad-container"
      >
        {/* Signature Pad Container - Feature #832: Enhanced styling */}
        <div
          className={cn(
            'relative rounded-lg overflow-hidden',
            'transition-all duration-200 ease-in-out',
            isFocused
              ? 'ring-2 ring-primary ring-offset-2 shadow-lg'
              : hasSignature
                ? 'ring-2 ring-success ring-offset-1'
                : 'border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50',
            fullWidth && 'w-full',
          )}
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
              stopDrawing();
              setIsFocused(false);
            }}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="cursor-crosshair touch-none bg-white"
            style={
              fullWidth
                ? { width: '100%', height: resolvedHeight }
                : { width, height: resolvedHeight }
            }
          />

          {/* Placeholder - Feature #832: Improved placeholder styling */}
          {!hasSignature && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <PenTool className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <span className="text-sm text-muted-foreground/50 font-medium">Sign here</span>
              <span className="text-xs text-muted-foreground/30 mt-1">Use mouse or touch</span>
            </div>
          )}

          {/* Success indicator overlay */}
          {hasSignature && !isDrawing && (
            <div className="absolute top-2 right-2 bg-success text-success-foreground rounded-full p-1 shadow-sm">
              <Check className="h-3 w-3" />
            </div>
          )}
        </div>
      </div>

      {/* Controls - Feature #832: Styled clear button */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {hasSignature ? (
            <span className="flex items-center gap-1.5 text-success font-medium">
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
          className={cn(
            'flex items-center gap-1.5 rounded-md transition-all duration-200',
            'min-h-[44px] min-w-[44px] px-3 py-1.5 text-xs font-medium',
            hasSignature
              ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30'
              : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50',
          )}
          disabled={!hasSignature}
          aria-label="Clear signature"
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
    </div>
  );
}
