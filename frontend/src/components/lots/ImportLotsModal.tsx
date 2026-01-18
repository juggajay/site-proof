import { useState, useRef } from 'react'
import { getAuthToken } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'
import { Upload, FileText, AlertCircle, AlertTriangle, CheckCircle2, X, Loader2 } from 'lucide-react'

interface ImportLotsModalProps {
  projectId: string
  onClose: () => void
  onSuccess: () => void
}

interface ValidationError {
  row: number
  field: string
  message: string
  type: 'error' | 'warning'
}

interface ParsedLot {
  row: number
  lotNumber: string
  description: string
  chainageStart: string
  chainageEnd: string
  activityType: string
  status: string
}

interface ValidationResult {
  lots: ParsedLot[]
  errors: ValidationError[]
  warnings: ValidationError[]
  isValid: boolean
}

export function ImportLotsModal({ projectId, onClose, onSuccess }: ImportLotsModalProps) {
  const [step, setStep] = useState<'upload' | 'validation' | 'importing'>('upload')
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [strictMode, setStrictMode] = useState(true) // Default to strict mode for atomicity
  const fileInputRef = useRef<HTMLInputElement>(null)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  // Parse CSV content
  const parseCSV = (content: string): ParsedLot[] => {
    const lines = content.trim().split('\n')
    if (lines.length < 2) return [] // Need header + at least one row

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    const lots: ParsedLot[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])

      const lot: ParsedLot = {
        row: i + 1, // 1-indexed for user display
        lotNumber: getFieldValue(headers, values, ['lot_number', 'lotnumber', 'lot number', 'lot']),
        description: getFieldValue(headers, values, ['description', 'desc']),
        chainageStart: getFieldValue(headers, values, ['chainage_start', 'chainagestart', 'start_chainage', 'start']),
        chainageEnd: getFieldValue(headers, values, ['chainage_end', 'chainageend', 'end_chainage', 'end']),
        activityType: getFieldValue(headers, values, ['activity_type', 'activitytype', 'activity', 'type']),
        status: getFieldValue(headers, values, ['status']),
      }
      lots.push(lot)
    }

    return lots
  }

  // Parse a single CSV line, handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  // Get field value by trying multiple possible column names
  const getFieldValue = (headers: string[], values: string[], possibleNames: string[]): string => {
    for (const name of possibleNames) {
      const index = headers.indexOf(name)
      if (index !== -1 && index < values.length) {
        return values[index].replace(/^["']|["']$/g, '')
      }
    }
    return ''
  }

  // Validate parsed lots
  const validateLots = (lots: ParsedLot[]): ValidationResult => {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []
    const lotNumbers = new Set<string>()

    for (const lot of lots) {
      // Required field validation - ERRORS
      if (!lot.lotNumber.trim()) {
        errors.push({
          row: lot.row,
          field: 'Lot Number',
          message: 'Lot Number is required',
          type: 'error'
        })
      } else if (lot.lotNumber.length < 3) {
        errors.push({
          row: lot.row,
          field: 'Lot Number',
          message: 'Lot Number must be at least 3 characters',
          type: 'error'
        })
      } else if (lot.lotNumber.length > 50) {
        errors.push({
          row: lot.row,
          field: 'Lot Number',
          message: 'Lot Number must be at most 50 characters',
          type: 'error'
        })
      } else if (lotNumbers.has(lot.lotNumber.toLowerCase())) {
        errors.push({
          row: lot.row,
          field: 'Lot Number',
          message: `Duplicate lot number "${lot.lotNumber}" in file`,
          type: 'error'
        })
      } else {
        lotNumbers.add(lot.lotNumber.toLowerCase())
      }

      // Chainage validation
      if (lot.chainageStart && lot.chainageEnd) {
        const start = parseFloat(lot.chainageStart)
        const end = parseFloat(lot.chainageEnd)
        if (isNaN(start)) {
          errors.push({
            row: lot.row,
            field: 'Chainage Start',
            message: 'Invalid chainage start value (must be a number)',
            type: 'error'
          })
        }
        if (isNaN(end)) {
          errors.push({
            row: lot.row,
            field: 'Chainage End',
            message: 'Invalid chainage end value (must be a number)',
            type: 'error'
          })
        }
        if (!isNaN(start) && !isNaN(end) && end <= start) {
          errors.push({
            row: lot.row,
            field: 'Chainage',
            message: 'End chainage must be greater than start chainage',
            type: 'error'
          })
        }
      }

      // WARNINGS - non-blocking issues
      if (!lot.description.trim()) {
        warnings.push({
          row: lot.row,
          field: 'Description',
          message: 'Description is empty - lot will be created without description',
          type: 'warning'
        })
      }

      if (!lot.activityType.trim()) {
        warnings.push({
          row: lot.row,
          field: 'Activity Type',
          message: 'Activity Type is empty - will default to "Earthworks"',
          type: 'warning'
        })
      }

      const validActivityTypes = ['Earthworks', 'Pavement', 'Drainage', 'Concrete', 'Structures']
      if (lot.activityType && !validActivityTypes.some(t => t.toLowerCase() === lot.activityType.toLowerCase())) {
        warnings.push({
          row: lot.row,
          field: 'Activity Type',
          message: `Unknown activity type "${lot.activityType}" - will default to "Earthworks"`,
          type: 'warning'
        })
      }
    }

    return {
      lots,
      errors,
      warnings,
      isValid: errors.length === 0
    }
  }

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast({ variant: 'error', description: 'Please select a CSV file' })
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const lots = parseCSV(content)

      if (lots.length === 0) {
        toast({ variant: 'error', description: 'No valid data found in CSV file' })
        return
      }

      const result = validateLots(lots)
      setValidationResult(result)
      setStep('validation')
    }
    reader.readAsText(file)

    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  // Import lots via API
  const handleImport = async () => {
    if (!validationResult || !validationResult.isValid) return

    setImporting(true)
    setStep('importing')
    setImportProgress(0)

    const token = getAuthToken()
    const lotsToImport = validationResult.lots

    // Strict mode: Use bulk endpoint with transaction (all or nothing)
    if (strictMode) {
      try {
        setImportProgress(50) // Show progress

        const lotsData = lotsToImport.map(lot => ({
          lotNumber: lot.lotNumber,
          description: lot.description || null,
          chainageStart: lot.chainageStart ? parseFloat(lot.chainageStart) : null,
          chainageEnd: lot.chainageEnd ? parseFloat(lot.chainageEnd) : null,
          activityType: lot.activityType || 'Earthworks',
        }))

        const response = await fetch(`${apiUrl}/api/lots/bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            projectId,
            lots: lotsData,
          }),
        })

        setImportProgress(100)
        setImporting(false)

        if (response.ok) {
          const data = await response.json()
          toast({ variant: 'success', description: `Successfully imported ${data.count} lots (strict mode - all or nothing)` })
          onSuccess()
          onClose()
        } else {
          const errorData = await response.json().catch(() => ({}))
          toast({
            variant: 'error',
            description: errorData.message || 'Import failed - no lots were created (strict mode rollback)'
          })
          // Don't close - let user try again or use non-strict mode
          setStep('validation')
        }
      } catch (err) {
        setImporting(false)
        toast({ variant: 'error', description: 'Import failed - no lots were created (strict mode rollback)' })
        setStep('validation')
      }
      return
    }

    // Non-strict mode: Import one at a time (partial success allowed)
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < lotsToImport.length; i++) {
      const lot = lotsToImport[i]

      try {
        const response = await fetch(`${apiUrl}/api/lots`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            projectId,
            lotNumber: lot.lotNumber,
            description: lot.description || null,
            chainageStart: lot.chainageStart ? parseFloat(lot.chainageStart) : null,
            chainageEnd: lot.chainageEnd ? parseFloat(lot.chainageEnd) : null,
            activityType: lot.activityType || 'Earthworks',
            status: lot.status || 'pending',
          }),
        })

        if (response.ok) {
          successCount++
        } else {
          failCount++
        }
      } catch (err) {
        failCount++
      }

      setImportProgress(Math.round(((i + 1) / lotsToImport.length) * 100))
    }

    setImporting(false)

    if (failCount === 0) {
      toast({ variant: 'success', description: `Successfully imported ${successCount} lots` })
      onSuccess()
      onClose()
    } else {
      toast({ variant: 'error', description: `Imported ${successCount} lots, ${failCount} failed` })
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-xl w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Lots from CSV
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Upload CSV File</p>
              <p className="text-sm text-muted-foreground mb-4">
                CSV should contain columns: lot_number, description, chainage_start, chainage_end, activity_type
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Select CSV File
              </button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Required columns:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code className="bg-muted px-1 rounded">lot_number</code> - Unique identifier (required)</li>
              </ul>
              <p className="font-medium mt-3 mb-1">Optional columns:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code className="bg-muted px-1 rounded">description</code></li>
                <li><code className="bg-muted px-1 rounded">chainage_start</code>, <code className="bg-muted px-1 rounded">chainage_end</code></li>
                <li><code className="bg-muted px-1 rounded">activity_type</code> (Earthworks, Pavement, Drainage, Concrete, Structures)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2: Validation Report */}
        {step === 'validation' && validationResult && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Summary */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1 p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Total Rows</p>
                <p className="text-2xl font-bold">{validationResult.lots.length}</p>
              </div>
              <div className={`flex-1 p-3 rounded-lg ${validationResult.errors.length > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  Errors
                </p>
                <p className="text-2xl font-bold text-red-600">{validationResult.errors.length}</p>
              </div>
              <div className={`flex-1 p-3 rounded-lg ${validationResult.warnings.length > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Warnings
                </p>
                <p className="text-2xl font-bold text-amber-600">{validationResult.warnings.length}</p>
              </div>
            </div>

            {/* Validation Messages */}
            <div className="flex-1 overflow-auto space-y-4 min-h-0">
              {/* Errors Section */}
              {validationResult.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 dark:bg-red-900/30 px-4 py-2 font-medium flex items-center gap-2 text-red-800 dark:text-red-200">
                    <AlertCircle className="h-4 w-4" />
                    Errors ({validationResult.errors.length}) - Must be fixed before import
                  </div>
                  <div className="divide-y max-h-40 overflow-auto">
                    {validationResult.errors.map((error, idx) => (
                      <div key={idx} className="px-4 py-2 text-sm flex items-start gap-2">
                        <span className="font-mono bg-red-100 dark:bg-red-900/50 px-1 rounded text-red-800 dark:text-red-200">
                          Row {error.row}
                        </span>
                        <span className="font-medium">{error.field}:</span>
                        <span className="text-muted-foreground">{error.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings Section */}
              {validationResult.warnings.length > 0 && (
                <div className="border border-amber-200 rounded-lg overflow-hidden">
                  <div className="bg-amber-50 dark:bg-amber-900/30 px-4 py-2 font-medium flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    Warnings ({validationResult.warnings.length}) - Non-blocking issues
                  </div>
                  <div className="divide-y max-h-40 overflow-auto">
                    {validationResult.warnings.map((warning, idx) => (
                      <div key={idx} className="px-4 py-2 text-sm flex items-start gap-2">
                        <span className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 rounded text-amber-800 dark:text-amber-200">
                          Row {warning.row}
                        </span>
                        <span className="font-medium">{warning.field}:</span>
                        <span className="text-muted-foreground">{warning.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success message */}
              {validationResult.isValid && (
                <div className="border border-green-200 rounded-lg p-4 bg-green-50 dark:bg-green-900/30 flex items-center gap-2 text-green-800 dark:text-green-200">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>All {validationResult.lots.length} rows passed validation. Ready to import!</span>
                </div>
              )}
            </div>

            {/* Import Mode Selection */}
            <div className="pt-4 mt-4 border-t">
              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={strictMode}
                    onChange={(e) => setStrictMode(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="font-medium">Strict Mode (All or Nothing)</span>
                </label>
                <span className="text-sm text-muted-foreground">
                  {strictMode
                    ? '— If any lot fails, no lots will be created'
                    : '— Partial imports allowed (some may fail)'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setValidationResult(null)
                    setStep('upload')
                  }}
                  className="px-4 py-2 border rounded-md hover:bg-muted"
                >
                  Upload Different File
                </button>
                <div className="flex-1" />
                <button onClick={onClose} className="px-4 py-2 border rounded-md hover:bg-muted">
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!validationResult.isValid}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import {validationResult.lots.length} Lots
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="py-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="text-lg font-medium mb-2">Importing Lots...</p>
            <div className="w-full bg-muted rounded-full h-2 mb-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">{importProgress}% complete</p>
          </div>
        )}
      </div>
    </div>
  )
}
