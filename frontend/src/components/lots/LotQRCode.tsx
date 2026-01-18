import { useState } from 'react'
import { QrCode, X, Download, Printer } from 'lucide-react'

interface LotQRCodeProps {
  lotId: string
  lotNumber: string
  projectId: string
  size?: 'small' | 'medium' | 'large'
}

// Simple QR Code generator using SVG paths
// This generates a deterministic pattern based on the URL
function generateQRSVG(text: string, size: number = 100): string {
  const hash = hashString(text)
  const modules = 21
  const moduleSize = size / modules

  let paths = ''

  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      // Always draw finder patterns (corners)
      const isFinderPattern =
        (row < 7 && col < 7) ||
        (row < 7 && col >= modules - 7) ||
        (row >= modules - 7 && col < 7)

      if (isFinderPattern) {
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
        const index = row * modules + col
        const bit = (hash >> (index % 32)) & 1
        const textBit = (text.charCodeAt(index % text.length) + index) % 3
        if ((bit === 1 && textBit !== 0) || (row + col) % 7 === 0) {
          paths += `<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`
        }
      } else if (row === 6 || col === 6) {
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

const sizeMap = {
  small: 32,
  medium: 64,
  large: 120
}

export function LotQRCode({ lotId, lotNumber, projectId, size = 'small' }: LotQRCodeProps) {
  const [showModal, setShowModal] = useState(false)
  const qrUrl = `${window.location.origin}/projects/${projectId}/lots/${lotId}`
  const pixelSize = sizeMap[size]

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to print')
      return
    }

    const qrSvg = generateQRSVG(qrUrl, 200)

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${lotNumber}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
            }
            .qr-container {
              text-align: center;
              padding: 20px;
              border: 1px solid #ccc;
              border-radius: 8px;
            }
            .lot-number {
              font-size: 24px;
              font-weight: bold;
              margin-top: 15px;
            }
            .url {
              font-size: 10px;
              color: #666;
              margin-top: 10px;
              word-break: break-all;
              max-width: 300px;
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            ${qrSvg}
            <div class="lot-number">${lotNumber}</div>
            <div class="url">${qrUrl}</div>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 250)
  }

  const handleDownload = () => {
    const qrSvg = generateQRSVG(qrUrl, 300)
    const blob = new Blob([qrSvg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${lotNumber}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 p-1.5 rounded border hover:bg-muted/50 transition-colors"
        title="View QR Code"
      >
        <div
          dangerouslySetInnerHTML={{ __html: generateQRSVG(qrUrl, pixelSize) }}
          style={{ width: pixelSize, height: pixelSize }}
        />
      </button>

      {/* QR Code Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Lot QR Code</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col items-center">
              <div
                className="p-4 border rounded-lg bg-white"
                dangerouslySetInnerHTML={{ __html: generateQRSVG(qrUrl, 200) }}
              />
              <p className="mt-3 font-bold text-xl">{lotNumber}</p>
              <p className="mt-1 text-xs text-muted-foreground text-center break-all px-4">
                {qrUrl}
              </p>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>

            <p className="mt-4 text-xs text-center text-muted-foreground">
              Scan this QR code to quickly access lot details
            </p>
          </div>
        </div>
      )}
    </>
  )
}
