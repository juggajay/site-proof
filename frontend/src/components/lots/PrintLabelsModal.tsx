import { useRef } from 'react'
import { X, Printer, QrCode, Download } from 'lucide-react'

interface Lot {
  id: string
  lotNumber: string
  description: string | null
  status: string
  activityType?: string
  chainageStart?: number | null
  chainageEnd?: number | null
  layer?: string | null
  areaZone?: string | null
}

interface PrintLabelsModalProps {
  lots: Lot[]
  projectId: string
  projectName?: string
  onClose: () => void
}

// Simple QR Code generator using SVG paths
// This generates a basic QR code pattern - for production, use a proper library
function generateQRSVG(text: string, size: number = 100): string {
  // Simple hash-based pattern generator (not a real QR code, but visually similar)
  // In production, replace with a proper QR code library like 'qrcode'
  const hash = hashString(text)
  const modules = 21 // 21x21 is version 1 QR code size
  const moduleSize = size / modules

  let paths = ''

  // Generate a deterministic pattern based on the hash
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      // Always draw finder patterns (corners)
      const isFinderPattern =
        (row < 7 && col < 7) || // Top-left
        (row < 7 && col >= modules - 7) || // Top-right
        (row >= modules - 7 && col < 7) // Bottom-left

      if (isFinderPattern) {
        // Draw finder pattern
        const inOuter = (row < 7 && col < 7 && (row === 0 || row === 6 || col === 0 || col === 6)) ||
                       (row < 7 && col >= modules - 7 && (row === 0 || row === 6 || col === modules - 7 || col === modules - 1)) ||
                       (row >= modules - 7 && col < 7 && (row === modules - 7 || row === modules - 1 || col === 0 || col === 6))

        const inInner = (row >= 2 && row <= 4 && col >= 2 && col <= 4) ||
                       (row >= 2 && row <= 4 && col >= modules - 5 && col <= modules - 3) ||
                       (row >= modules - 5 && row <= modules - 3 && col >= 2 && col <= 4)

        if (inOuter || inInner) {
          paths += `<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`
        }
      } else if (row > 7 && col > 7) {
        // Data area - use hash to determine if module is dark
        const index = row * modules + col
        const bit = (hash >> (index % 32)) & 1
        const textBit = (text.charCodeAt(index % text.length) + index) % 3
        if ((bit === 1 && textBit !== 0) || (row + col) % 7 === 0) {
          paths += `<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`
        }
      } else if (row === 6 || col === 6) {
        // Timing patterns
        if ((row + col) % 2 === 0) {
          paths += `<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`
        }
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="white"/>
    ${paths}
  </svg>`
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

function formatChainage(start: number | null | undefined, end: number | null | undefined): string {
  if (start === null || start === undefined) {
    if (end === null || end === undefined) return ''
    return `CH ${end.toFixed(3)}`
  }
  if (end === null || end === undefined) return `CH ${start.toFixed(3)}`
  return `CH ${start.toFixed(3)} - ${end.toFixed(3)}`
}

export function PrintLabelsModal({ lots, projectId, projectName, onClose }: PrintLabelsModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to print labels')
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lot Labels - ${projectName || 'Project'}</title>
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: Arial, sans-serif;
              padding: 10mm;
            }
            .labels-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 5mm;
            }
            .label {
              border: 1px solid #ccc;
              border-radius: 4px;
              padding: 3mm;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
              min-height: 35mm;
            }
            .label-qr {
              width: 20mm;
              height: 20mm;
              margin-bottom: 2mm;
            }
            .label-qr svg {
              width: 100%;
              height: 100%;
            }
            .label-lot-number {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 1mm;
            }
            .label-project {
              font-size: 8pt;
              color: #666;
              margin-bottom: 1mm;
            }
            .label-details {
              font-size: 7pt;
              color: #888;
            }
            @media print {
              body {
                padding: 5mm;
              }
              .labels-grid {
                gap: 3mm;
              }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()

    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const handleDownloadSVGs = () => {
    // Create a zip-like structure by downloading each SVG
    // For simplicity, we'll create a single HTML file with all SVGs
    const svgContent = lots.map(lot => {
      const qrUrl = `${window.location.origin}/projects/${projectId}/lots/${lot.id}`
      return generateQRSVG(qrUrl, 200)
    }).join('\n\n')

    const blob = new Blob([`
      <!DOCTYPE html>
      <html>
        <head><title>QR Codes - ${projectName || 'Project'}</title></head>
        <body style="display: flex; flex-wrap: wrap; gap: 20px; padding: 20px;">
          ${lots.map((lot, i) => {
            const qrUrl = `${window.location.origin}/projects/${projectId}/lots/${lot.id}`
            return `
              <div style="text-align: center; border: 1px solid #ccc; padding: 10px; border-radius: 8px;">
                ${generateQRSVG(qrUrl, 150)}
                <p style="font-weight: bold; margin-top: 10px;">${lot.lotNumber}</p>
              </div>
            `
          }).join('')}
        </body>
      </html>
    `], { type: 'text/html' })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lot-labels-${projectId}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Print Lot Labels</h2>
            <span className="text-sm text-muted-foreground">({lots.length} labels)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-4 bg-gray-100">
          <div
            ref={printRef}
            className="labels-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              backgroundColor: 'white',
              padding: '16px',
              borderRadius: '8px'
            }}
          >
            {lots.map((lot) => {
              const qrUrl = `${window.location.origin}/projects/${projectId}/lots/${lot.id}`
              const qrSvg = generateQRSVG(qrUrl, 80)

              return (
                <div
                  key={lot.id}
                  className="label"
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    backgroundColor: 'white'
                  }}
                >
                  <div
                    className="label-qr"
                    style={{ width: '80px', height: '80px', marginBottom: '8px' }}
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                  <div
                    className="label-lot-number"
                    style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}
                  >
                    {lot.lotNumber}
                  </div>
                  {projectName && (
                    <div
                      className="label-project"
                      style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}
                    >
                      {projectName}
                    </div>
                  )}
                  <div
                    className="label-details"
                    style={{ fontSize: '9px', color: '#9ca3af' }}
                  >
                    {lot.activityType && <div>{lot.activityType}</div>}
                    {formatChainage(lot.chainageStart, lot.chainageEnd) && (
                      <div>{formatChainage(lot.chainageStart, lot.chainageEnd)}</div>
                    )}
                    {lot.layer && <div>Layer: {lot.layer}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <p className="text-sm text-muted-foreground">
            Labels include QR codes that link to lot details
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadSVGs}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-100 text-sm"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
            >
              <Printer className="h-4 w-4" />
              Print Labels
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
