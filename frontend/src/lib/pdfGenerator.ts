import { jsPDF } from 'jspdf'

// Conformance package format types for Australian road authorities
export type ConformanceFormat = 'standard' | 'tmr' | 'tfnsw' | 'vicroads'

export interface ConformanceFormatOptions {
  format: ConformanceFormat
  includeITPChecklist: boolean
  includeTestResults: boolean
  includeHoldPoints: boolean
  includeNCRs: boolean
  includePhotos: boolean
  clientName?: string
  contractNumber?: string
}

// Default format options
export const defaultConformanceOptions: ConformanceFormatOptions = {
  format: 'standard',
  includeITPChecklist: true,
  includeTestResults: true,
  includeHoldPoints: true,
  includeNCRs: true,
  includePhotos: true,
}

// Format-specific configurations
const FORMAT_CONFIGS: Record<ConformanceFormat, {
  title: string
  subtitle: string
  headerColor: [number, number, number]
  requiresSignature: boolean
  includesSpecReference: boolean
  specPrefix: string
}> = {
  standard: {
    title: 'LOT CONFORMANCE REPORT',
    subtitle: 'Quality Conformance Documentation',
    headerColor: [37, 99, 235], // Blue
    requiresSignature: false,
    includesSpecReference: false,
    specPrefix: '',
  },
  tmr: {
    title: 'LOT CONFORMANCE CERTIFICATE',
    subtitle: 'Transport and Main Roads Queensland - MRTS Compliance',
    headerColor: [0, 83, 159], // TMR Blue
    requiresSignature: true,
    includesSpecReference: true,
    specPrefix: 'MRTS',
  },
  tfnsw: {
    title: 'LOT CONFORMANCE CERTIFICATE',
    subtitle: 'Transport for NSW - QA Specification Compliance',
    headerColor: [0, 38, 100], // TfNSW Navy
    requiresSignature: true,
    includesSpecReference: true,
    specPrefix: 'TfNSW Q',
  },
  vicroads: {
    title: 'LOT CONFORMANCE CERTIFICATE',
    subtitle: 'Department of Transport Victoria - Section Compliance',
    headerColor: [0, 70, 127], // VicRoads Blue
    requiresSignature: true,
    includesSpecReference: true,
    specPrefix: 'Section',
  },
}

// Types for conformance report data
interface ITPChecklistItem {
  order: number
  description: string
  category: string
  responsibleParty: string
  pointType: string
  isHoldPoint: boolean
  evidenceRequired: string
}

interface ITPCompletion {
  checklistItemId: string
  isCompleted: boolean
  notes: string | null
  completedAt: string | null
  completedBy: { fullName: string | null; email: string } | null
  isVerified: boolean
  verifiedAt: string | null
  verifiedBy: { fullName: string | null; email: string } | null
}

interface TestResult {
  testType: string
  testRequestNumber: string | null
  laboratoryName: string | null
  resultValue: number | null
  resultUnit: string | null
  passFail: string
  status: string
  sampleDate: string | null
  resultDate: string | null
}

interface NCR {
  ncrNumber: string
  description: string
  category: string
  severity: string
  status: string
  createdAt: string
  closedAt: string | null
}

interface HoldPointRelease {
  checklistItemDescription: string
  releasedAt: string
  releasedBy: { fullName: string | null; email: string } | null
}

interface ConformanceReportData {
  lot: {
    lotNumber: string
    description: string | null
    status: string
    activityType: string | null
    chainageStart: number | null
    chainageEnd: number | null
    layer: string | null
    areaZone: string | null
    conformedAt: string | null
    conformedBy: { fullName: string | null; email: string } | null
  }
  project: {
    name: string
    projectNumber: string | null
  }
  itp: {
    templateName: string
    checklistItems: ITPChecklistItem[]
    completions: ITPCompletion[]
  } | null
  testResults: TestResult[]
  ncrs: NCR[]
  holdPointReleases: HoldPointRelease[]
  photoCount: number
}

/**
 * Generate a PDF conformance report for a lot
 * Supports multiple formats: standard, TMR (Queensland), TfNSW (NSW), VicRoads
 */
export function generateConformanceReportPDF(
  data: ConformanceReportData,
  options: ConformanceFormatOptions = defaultConformanceOptions
): void {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let yPos = margin

  // Get format-specific configuration
  const formatConfig = FORMAT_CONFIGS[options.format]

  // Helper to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage()
      yPos = margin
      return true
    }
    return false
  }

  // Helper to draw a line
  const drawLine = () => {
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 5
  }

  // ========== HEADER (Format-specific) ==========
  // Colored header bar for road authority formats
  if (options.format !== 'standard') {
    doc.setFillColor(...formatConfig.headerColor)
    doc.rect(0, 0, pageWidth, 25, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(formatConfig.title, pageWidth / 2, 15, { align: 'center' })
    doc.setTextColor(0, 0, 0)
    yPos = 35
  } else {
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(formatConfig.title, pageWidth / 2, yPos, { align: 'center' })
    yPos += 10
  }

  // Subtitle for road authority formats
  if (options.format !== 'standard') {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.text(formatConfig.subtitle, pageWidth / 2, yPos, { align: 'center' })
    yPos += 8
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(data.lot.lotNumber, pageWidth / 2, yPos, { align: 'center' })
  yPos += 15

  drawLine()

  // ========== PROJECT & LOT INFO ==========
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Project Information', margin, yPos)
  yPos += 7

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Project: ${data.project.name}`, margin, yPos)
  yPos += 5
  if (data.project.projectNumber) {
    doc.text(`Project #: ${data.project.projectNumber}`, margin, yPos)
    yPos += 5
  }
  yPos += 5

  doc.setFont('helvetica', 'bold')
  doc.text('Lot Information', margin, yPos)
  yPos += 7

  doc.setFont('helvetica', 'normal')
  doc.text(`Lot Number: ${data.lot.lotNumber}`, margin, yPos)
  yPos += 5
  if (data.lot.description) {
    doc.text(`Description: ${data.lot.description}`, margin, yPos)
    yPos += 5
  }
  doc.text(`Activity Type: ${data.lot.activityType || 'N/A'}`, margin, yPos)
  yPos += 5
  if (data.lot.chainageStart != null && data.lot.chainageEnd != null) {
    doc.text(`Chainage: ${data.lot.chainageStart} - ${data.lot.chainageEnd}`, margin, yPos)
    yPos += 5
  }
  if (data.lot.layer) {
    doc.text(`Layer: ${data.lot.layer}`, margin, yPos)
    yPos += 5
  }
  if (data.lot.areaZone) {
    doc.text(`Area/Zone: ${data.lot.areaZone}`, margin, yPos)
    yPos += 5
  }
  yPos += 5

  // ========== CONFORMANCE STATUS ==========
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(34, 197, 94) // Green
  doc.rect(margin, yPos, contentWidth, 15, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.text('STATUS: CONFORMED', pageWidth / 2, yPos + 10, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  yPos += 20

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (data.lot.conformedAt) {
    const conformedDate = new Date(data.lot.conformedAt).toLocaleString('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    doc.text(`Conformed on: ${conformedDate}`, margin, yPos)
    yPos += 5
  }
  if (data.lot.conformedBy) {
    doc.text(`Conformed by: ${data.lot.conformedBy.fullName || data.lot.conformedBy.email}`, margin, yPos)
    yPos += 5
  }
  yPos += 10

  drawLine()

  // ========== ITP CHECKLIST SUMMARY ==========
  checkPageBreak(30)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('ITP Checklist Summary', margin, yPos)
  yPos += 7

  if (data.itp) {
    const totalItems = data.itp.checklistItems.length
    const completedItems = data.itp.completions.filter(c => c.isCompleted).length

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Template: ${data.itp.templateName}`, margin, yPos)
    yPos += 5
    doc.text(`Checklist Completion: ${completedItems} / ${totalItems} items (${Math.round((completedItems / totalItems) * 100)}%)`, margin, yPos)
    yPos += 8

    // ITP Items table
    const itemsPerColumn = ['#', 'Description', 'Type', 'Status', 'Completed By']
    const colWidths = [10, 70, 25, 25, 40]

    // Table header
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, yPos, contentWidth, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    let xPos = margin + 2
    itemsPerColumn.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5)
      xPos += colWidths[i]
    })
    yPos += 8

    // Table rows
    doc.setFont('helvetica', 'normal')
    data.itp.checklistItems.forEach((item) => {
      checkPageBreak(8)
      const completion = data.itp!.completions.find(c => c.checklistItemId === item.order.toString())
      const isCompleted = completion?.isCompleted || false

      xPos = margin + 2
      doc.text(item.order.toString(), xPos, yPos + 4)
      xPos += colWidths[0]

      // Truncate description if too long
      const desc = item.description.length > 40 ? item.description.slice(0, 37) + '...' : item.description
      doc.text(desc, xPos, yPos + 4)
      xPos += colWidths[1]

      doc.text(item.pointType === 'hold_point' ? 'HP' : item.pointType === 'witness' ? 'W' : 'S', xPos, yPos + 4)
      xPos += colWidths[2]

      doc.text(isCompleted ? 'Done' : 'Pending', xPos, yPos + 4)
      xPos += colWidths[3]

      if (completion?.completedBy) {
        const completedBy = completion.completedBy.fullName || completion.completedBy.email
        const truncatedName = completedBy.length > 25 ? completedBy.slice(0, 22) + '...' : completedBy
        doc.text(truncatedName, xPos, yPos + 4)
      }

      yPos += 6
    })
  } else {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.text('No ITP assigned to this lot.', margin, yPos)
    yPos += 5
  }
  yPos += 10

  drawLine()

  // ========== TEST RESULTS SUMMARY ==========
  checkPageBreak(30)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Test Results Summary', margin, yPos)
  yPos += 7

  if (data.testResults.length > 0) {
    const passedTests = data.testResults.filter(t => t.passFail === 'pass').length
    const failedTests = data.testResults.filter(t => t.passFail === 'fail').length

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Total Tests: ${data.testResults.length}`, margin, yPos)
    yPos += 5
    doc.text(`Passed: ${passedTests} | Failed: ${failedTests}`, margin, yPos)
    yPos += 8

    // Test results table header
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, yPos, contentWidth, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    const testHeaders = ['Test Type', 'Lab', 'Result', 'Pass/Fail', 'Status']
    const testColWidths = [40, 35, 35, 25, 35]
    let txPos = margin + 2
    testHeaders.forEach((header, i) => {
      doc.text(header, txPos, yPos + 5)
      txPos += testColWidths[i]
    })
    yPos += 8

    // Test rows
    doc.setFont('helvetica', 'normal')
    data.testResults.slice(0, 10).forEach((test) => { // Limit to 10 for brevity
      checkPageBreak(8)
      txPos = margin + 2
      doc.text(test.testType.slice(0, 20), txPos, yPos + 4)
      txPos += testColWidths[0]
      doc.text((test.laboratoryName || 'N/A').slice(0, 18), txPos, yPos + 4)
      txPos += testColWidths[1]
      const result = test.resultValue != null ? `${test.resultValue} ${test.resultUnit || ''}` : 'N/A'
      doc.text(result.slice(0, 18), txPos, yPos + 4)
      txPos += testColWidths[2]
      doc.text(test.passFail || 'Pending', txPos, yPos + 4)
      txPos += testColWidths[3]
      doc.text(test.status, txPos, yPos + 4)
      yPos += 6
    })

    if (data.testResults.length > 10) {
      doc.setFont('helvetica', 'italic')
      doc.text(`... and ${data.testResults.length - 10} more test results`, margin, yPos + 4)
      yPos += 6
    }
  } else {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.text('No test results recorded for this lot.', margin, yPos)
    yPos += 5
  }
  yPos += 10

  drawLine()

  // ========== HOLD POINT RELEASES ==========
  checkPageBreak(20)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Hold Point Releases', margin, yPos)
  yPos += 7

  if (data.holdPointReleases.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    data.holdPointReleases.forEach((hp) => {
      checkPageBreak(12)
      doc.text(`- ${hp.checklistItemDescription}`, margin, yPos)
      yPos += 5
      const releasedDate = new Date(hp.releasedAt).toLocaleString('en-AU', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
      const releasedBy = hp.releasedBy ? (hp.releasedBy.fullName || hp.releasedBy.email) : 'Unknown'
      doc.setFont('helvetica', 'italic')
      doc.text(`  Released: ${releasedDate} by ${releasedBy}`, margin + 5, yPos)
      doc.setFont('helvetica', 'normal')
      yPos += 6
    })
  } else {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.text('No hold points on this lot, or all hold points released.', margin, yPos)
    yPos += 5
  }
  yPos += 10

  drawLine()

  // ========== NCR SUMMARY ==========
  checkPageBreak(20)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('NCR Summary', margin, yPos)
  yPos += 7

  if (data.ncrs.length > 0) {
    const openNcrs = data.ncrs.filter(n => !['closed', 'closed_concession'].includes(n.status)).length
    const closedNcrs = data.ncrs.filter(n => ['closed', 'closed_concession'].includes(n.status)).length

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Total NCRs: ${data.ncrs.length} (Open: ${openNcrs}, Closed: ${closedNcrs})`, margin, yPos)
    yPos += 8

    data.ncrs.forEach((ncr) => {
      checkPageBreak(12)
      doc.setFont('helvetica', 'bold')
      doc.text(`${ncr.ncrNumber} - ${ncr.severity.toUpperCase()}`, margin, yPos)
      yPos += 5
      doc.setFont('helvetica', 'normal')
      const desc = ncr.description.length > 80 ? ncr.description.slice(0, 77) + '...' : ncr.description
      doc.text(`  ${desc}`, margin, yPos)
      yPos += 5
      doc.text(`  Status: ${ncr.status.replace('_', ' ')} | Category: ${ncr.category}`, margin, yPos)
      yPos += 6
    })
  } else {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.text('No NCRs raised for this lot.', margin, yPos)
    yPos += 5
  }
  yPos += 10

  drawLine()

  // ========== PHOTOS ==========
  checkPageBreak(15)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Photo Evidence', margin, yPos)
  yPos += 7

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`${data.photoCount} photos attached to ITP checklist items.`, margin, yPos)
  yPos += 5
  doc.setFont('helvetica', 'italic')
  doc.text('(Photo images available in the SiteProof system)', margin, yPos)
  yPos += 10

  // ========== SIGNATURE BLOCK (Road Authority Formats) ==========
  if (formatConfig.requiresSignature) {
    checkPageBreak(70)
    drawLine()
    yPos += 5

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('CONFORMANCE CERTIFICATION', margin, yPos)
    yPos += 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('I hereby certify that this lot has been constructed in accordance with the contract', margin, yPos)
    yPos += 5
    doc.text('documents and relevant specifications.', margin, yPos)
    yPos += 15

    // Contractor signature
    doc.text('Contractor Representative:', margin, yPos)
    yPos += 12
    doc.line(margin, yPos, margin + 70, yPos)
    yPos += 5
    doc.setFontSize(8)
    doc.text('Signature', margin, yPos)
    doc.text('Date: _______________', margin + 80, yPos - 5)
    yPos += 8
    doc.line(margin, yPos, margin + 70, yPos)
    yPos += 5
    doc.text('Print Name', margin, yPos)
    yPos += 15

    // Superintendent signature (for TMR/TfNSW)
    if (options.format === 'tmr' || options.format === 'tfnsw') {
      doc.setFontSize(10)
      doc.text('Superintendent / Client Representative:', margin, yPos)
      yPos += 12
      doc.line(margin, yPos, margin + 70, yPos)
      yPos += 5
      doc.setFontSize(8)
      doc.text('Signature', margin, yPos)
      doc.text('Date: _______________', margin + 80, yPos - 5)
      yPos += 8
      doc.line(margin, yPos, margin + 70, yPos)
      yPos += 5
      doc.text('Print Name', margin, yPos)
      yPos += 10
    }
  }

  // ========== FOOTER ==========
  checkPageBreak(20)
  drawLine()
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(128, 128, 128)
  const generatedDate = new Date().toLocaleString('en-AU', {
    dateStyle: 'full',
    timeStyle: 'medium',
  })
  doc.text(`Generated: ${generatedDate}`, margin, yPos)
  yPos += 4

  // Format-specific footer text
  if (options.format === 'tmr') {
    doc.text('Prepared in accordance with TMR MRTS Standards - SiteProof v2', margin, yPos)
  } else if (options.format === 'tfnsw') {
    doc.text('Prepared in accordance with TfNSW QA Specifications - SiteProof v2', margin, yPos)
  } else if (options.format === 'vicroads') {
    doc.text('Prepared in accordance with DOT Victoria Section Specifications - SiteProof v2', margin, yPos)
  } else {
    doc.text('This report was generated by SiteProof v2 - Construction Quality Management System', margin, yPos)
  }

  // Save the PDF with format-specific filename
  const formatSuffix = options.format !== 'standard' ? `-${options.format.toUpperCase()}` : ''
  const filename = `Conformance-Report-${data.lot.lotNumber}${formatSuffix}-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

// Types for HP Evidence Package
interface HPEvidencePackageData {
  holdPoint: {
    id: string
    description: string
    status: string
    notificationSentAt: string | null
    scheduledDate: string | null
    releasedAt: string | null
    releasedByName: string | null
    releaseNotes: string | null
  }
  lot: {
    id: string
    lotNumber: string
    description: string | null
    activityType: string | null
    chainageStart: number | null
    chainageEnd: number | null
  }
  project: {
    id: string
    name: string
    projectNumber: string | null
  }
  itpTemplate: {
    id: string
    name: string
    activityType: string | null
  }
  checklist: {
    sequenceNumber: number
    description: string
    pointType: string | null
    responsibleParty: string | null
    isCompleted: boolean
    completedAt: string | null
    completedBy: string | null
    isVerified: boolean
    verifiedAt: string | null
    verifiedBy: string | null
    notes: string | null
    attachments: {
      id: string
      filename: string
      fileUrl: string | null
      caption: string | null
    }[]
  }[]
  testResults: {
    id: string
    testType: string
    testRequestNumber: string | null
    laboratoryName: string | null
    resultValue: number | null
    resultUnit: string | null
    passFail: string | null
    status: string
    isVerified: boolean
    verifiedBy: string | null
    createdAt: string
  }[]
  photos: {
    id: string
    filename: string
    fileUrl: string | null
    caption: string | null
    uploadedAt: string | null
  }[]
  summary: {
    totalChecklistItems: number
    completedItems: number
    verifiedItems: number
    totalTestResults: number
    passingTests: number
    totalPhotos: number
    totalAttachments: number
  }
  generatedAt: string
}

/**
 * Generate a PDF evidence package for a Hold Point release
 */
export function generateHPEvidencePackagePDF(data: HPEvidencePackageData): void {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let yPos = margin

  // Helper to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage()
      yPos = margin
      return true
    }
    return false
  }

  // Helper to draw a line
  const drawLine = () => {
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 5
  }

  // ========== HEADER ==========
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('HOLD POINT EVIDENCE PACKAGE', pageWidth / 2, yPos, { align: 'center' })
  yPos += 12

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(`Lot: ${data.lot.lotNumber}`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 15

  drawLine()

  // ========== HOLD POINT IDENTIFICATION ==========
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('1. Hold Point Identification', margin, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  // Hold Point Status Box
  const statusColor = data.holdPoint.status === 'released'
    ? [34, 197, 94] // Green
    : data.holdPoint.status === 'notified'
    ? [234, 179, 8] // Amber
    : [156, 163, 175] // Gray

  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
  doc.rect(margin, yPos, contentWidth, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  const statusText = data.holdPoint.status === 'released' ? 'RELEASED' : data.holdPoint.status.toUpperCase()
  doc.text(`STATUS: ${statusText}`, pageWidth / 2, yPos + 8, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  yPos += 17

  doc.setFont('helvetica', 'normal')
  doc.text(`Hold Point Description: ${data.holdPoint.description}`, margin, yPos)
  yPos += 6

  if (data.holdPoint.scheduledDate) {
    const scheduledDate = new Date(data.holdPoint.scheduledDate).toLocaleString('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
    doc.text(`Scheduled Date: ${scheduledDate}`, margin, yPos)
    yPos += 6
  }

  if (data.holdPoint.releasedAt) {
    const releasedDate = new Date(data.holdPoint.releasedAt).toLocaleString('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
    doc.text(`Released: ${releasedDate}`, margin, yPos)
    yPos += 6
  }

  if (data.holdPoint.releasedByName) {
    doc.text(`Released By: ${data.holdPoint.releasedByName}`, margin, yPos)
    yPos += 6
  }

  if (data.holdPoint.releaseNotes) {
    doc.text(`Release Notes: ${data.holdPoint.releaseNotes}`, margin, yPos)
    yPos += 6
  }
  yPos += 5
  drawLine()

  // ========== LOT DETAILS ==========
  checkPageBreak(50)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('2. Lot Details', margin, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Project: ${data.project.name}`, margin, yPos)
  yPos += 5
  if (data.project.projectNumber) {
    doc.text(`Project Number: ${data.project.projectNumber}`, margin, yPos)
    yPos += 5
  }
  doc.text(`Lot Number: ${data.lot.lotNumber}`, margin, yPos)
  yPos += 5
  if (data.lot.description) {
    doc.text(`Description: ${data.lot.description}`, margin, yPos)
    yPos += 5
  }
  if (data.lot.activityType) {
    doc.text(`Activity Type: ${data.lot.activityType}`, margin, yPos)
    yPos += 5
  }
  if (data.lot.chainageStart != null && data.lot.chainageEnd != null) {
    doc.text(`Chainage: ${data.lot.chainageStart} - ${data.lot.chainageEnd}`, margin, yPos)
    yPos += 5
  }
  doc.text(`ITP Template: ${data.itpTemplate.name}`, margin, yPos)
  yPos += 10

  drawLine()

  // ========== COMPLETED CHECKLIST ITEMS ==========
  checkPageBreak(40)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('3. Completed Checklist Items', margin, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Completion Status: ${data.summary.completedItems} / ${data.summary.totalChecklistItems} items completed`, margin, yPos)
  yPos += 8

  // Checklist table header
  const headers = ['#', 'Description', 'Type', 'Status', 'Completed By']
  const colWidths = [10, 75, 20, 25, 40]

  doc.setFillColor(240, 240, 240)
  doc.rect(margin, yPos, contentWidth, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  let xPos = margin + 2
  headers.forEach((header, i) => {
    doc.text(header, xPos, yPos + 5)
    xPos += colWidths[i]
  })
  yPos += 9

  // Checklist rows
  doc.setFont('helvetica', 'normal')
  data.checklist.forEach((item) => {
    checkPageBreak(8)
    xPos = margin + 2

    doc.text(item.sequenceNumber.toString(), xPos, yPos + 4)
    xPos += colWidths[0]

    const desc = item.description.length > 45 ? item.description.slice(0, 42) + '...' : item.description
    doc.text(desc, xPos, yPos + 4)
    xPos += colWidths[1]

    const typeLabel = item.pointType === 'hold_point' ? 'HP' : item.pointType === 'witness' ? 'W' : 'S'
    doc.text(typeLabel, xPos, yPos + 4)
    xPos += colWidths[2]

    const statusLabel = item.isVerified ? 'Verified' : item.isCompleted ? 'Done' : 'Pending'
    doc.text(statusLabel, xPos, yPos + 4)
    xPos += colWidths[3]

    if (item.completedBy) {
      const completedBy = item.completedBy.length > 22 ? item.completedBy.slice(0, 19) + '...' : item.completedBy
      doc.text(completedBy, xPos, yPos + 4)
    }

    yPos += 6
  })
  yPos += 8

  drawLine()

  // ========== TEST RESULTS ==========
  checkPageBreak(40)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('4. Test Results', margin, yPos)
  yPos += 8

  if (data.testResults.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Total Tests: ${data.summary.totalTestResults} | Passing: ${data.summary.passingTests}`, margin, yPos)
    yPos += 8

    // Test table header
    const testHeaders = ['Test Type', 'Lab', 'Result', 'Pass/Fail', 'Verified']
    const testColWidths = [40, 35, 35, 25, 35]

    doc.setFillColor(240, 240, 240)
    doc.rect(margin, yPos, contentWidth, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    xPos = margin + 2
    testHeaders.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5)
      xPos += testColWidths[i]
    })
    yPos += 9

    // Test rows
    doc.setFont('helvetica', 'normal')
    data.testResults.forEach((test) => {
      checkPageBreak(8)
      xPos = margin + 2

      doc.text(test.testType.slice(0, 22), xPos, yPos + 4)
      xPos += testColWidths[0]

      doc.text((test.laboratoryName || 'N/A').slice(0, 18), xPos, yPos + 4)
      xPos += testColWidths[1]

      const result = test.resultValue != null ? `${test.resultValue} ${test.resultUnit || ''}` : 'N/A'
      doc.text(result.slice(0, 18), xPos, yPos + 4)
      xPos += testColWidths[2]

      doc.text(test.passFail || 'Pending', xPos, yPos + 4)
      xPos += testColWidths[3]

      doc.text(test.isVerified ? 'Yes' : 'No', xPos, yPos + 4)
      yPos += 6
    })
  } else {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.text('No test results recorded for this lot.', margin, yPos)
    yPos += 5
  }
  yPos += 8

  drawLine()

  // ========== PHOTOS & ATTACHMENTS ==========
  checkPageBreak(30)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('5. Photos & Evidence', margin, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Photos: ${data.summary.totalPhotos}`, margin, yPos)
  yPos += 5
  doc.text(`Checklist Attachments: ${data.summary.totalAttachments}`, margin, yPos)
  yPos += 5

  if (data.photos.length > 0) {
    yPos += 3
    doc.setFont('helvetica', 'bold')
    doc.text('Photo List:', margin, yPos)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    data.photos.slice(0, 10).forEach((photo) => {
      checkPageBreak(6)
      const uploadDate = photo.uploadedAt ? new Date(photo.uploadedAt).toLocaleDateString('en-AU') : ''
      doc.text(`- ${photo.filename}${photo.caption ? ` (${photo.caption})` : ''} ${uploadDate}`, margin + 5, yPos)
      yPos += 5
    })
    if (data.photos.length > 10) {
      doc.setFont('helvetica', 'italic')
      doc.text(`... and ${data.photos.length - 10} more photos`, margin + 5, yPos)
      yPos += 5
    }
  }

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.text('(Full photo images available in SiteProof system)', margin, yPos)
  yPos += 10

  drawLine()

  // ========== SURVEY DATA ==========
  checkPageBreak(20)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('6. Survey Data', margin, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (data.lot.chainageStart != null || data.lot.chainageEnd != null) {
    doc.text(`Chainage Range: ${data.lot.chainageStart ?? 'N/A'} - ${data.lot.chainageEnd ?? 'N/A'}`, margin, yPos)
    yPos += 5
  }
  doc.setFont('helvetica', 'italic')
  doc.text('(Survey coordinates and as-built data available in SiteProof system)', margin, yPos)
  yPos += 10

  drawLine()

  // ========== SUMMARY ==========
  checkPageBreak(40)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('7. Evidence Summary', margin, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  // Summary box
  doc.setFillColor(245, 245, 245)
  doc.rect(margin, yPos, contentWidth, 35, 'F')
  yPos += 6

  doc.text(`Checklist Items Completed: ${data.summary.completedItems} / ${data.summary.totalChecklistItems}`, margin + 5, yPos)
  yPos += 5
  doc.text(`Items Verified: ${data.summary.verifiedItems}`, margin + 5, yPos)
  yPos += 5
  doc.text(`Test Results: ${data.summary.totalTestResults} (${data.summary.passingTests} passing)`, margin + 5, yPos)
  yPos += 5
  doc.text(`Photos: ${data.summary.totalPhotos}`, margin + 5, yPos)
  yPos += 5
  doc.text(`Attachments: ${data.summary.totalAttachments}`, margin + 5, yPos)
  yPos += 15

  // ========== FOOTER ==========
  drawLine()
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(128, 128, 128)
  const generatedDate = new Date(data.generatedAt).toLocaleString('en-AU', {
    dateStyle: 'full',
    timeStyle: 'medium'
  })
  doc.text(`Generated: ${generatedDate}`, margin, yPos)
  yPos += 4
  doc.text('This evidence package was generated by SiteProof v2 - Civil Execution and Conformance Platform', margin, yPos)

  // Save the PDF
  const filename = `HP-Evidence-Package-${data.lot.lotNumber}-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

// Types for Claim Evidence Package
interface ClaimEvidencePackageData {
  claim: {
    id: string
    claimNumber: number
    periodStart: string
    periodEnd: string
    status: string
    totalClaimedAmount: number
    certifiedAmount: number | null
    submittedAt: string | null
    preparedBy: { name: string; email: string } | null
    preparedAt: string | null
  }
  project: {
    id: string
    name: string
    projectNumber: string | null
    clientName: string | null
    state: string
  }
  lots: {
    id: string
    lotNumber: string
    description: string | null
    activityType: string | null
    chainageStart: number | null
    chainageEnd: number | null
    layer: string | null
    areaZone: string | null
    status: string
    conformedAt: string | null
    conformedBy: { name: string; email: string } | null
    claimAmount: number
    percentComplete: number
    itp: {
      templateName: string
      checklistItems: any[]
      completions: any[]
      holdPoints: any[]
    } | null
    testResults: any[]
    ncrs: any[]
    documents: any[]
    summary: {
      testResultCount: number
      passedTestCount: number
      ncrCount: number
      openNcrCount: number
      photoCount: number
      itpCompletionPercentage: number
    }
  }[]
  summary: {
    totalLots: number
    totalClaimedAmount: number
    totalTestResults: number
    totalPassedTests: number
    totalNCRs: number
    totalOpenNCRs: number
    totalPhotos: number
    conformedLots: number
  }
  generatedAt: string
  generationTimeMs: number
}

// Options for customizing the claim evidence package
export interface ClaimPackageOptions {
  includeLotSummary: boolean
  includeLotDetails: boolean
  includeITPChecklists: boolean
  includeTestResults: boolean
  includeNCRs: boolean
  includeHoldPoints: boolean
  includePhotos: boolean
  includeDeclaration: boolean
}

const defaultPackageOptions: ClaimPackageOptions = {
  includeLotSummary: true,
  includeLotDetails: true,
  includeITPChecklists: true,
  includeTestResults: true,
  includeNCRs: true,
  includeHoldPoints: true,
  includePhotos: true,
  includeDeclaration: true,
}

/**
 * Generate a PDF evidence package for a Progress Claim (SOPA compliant)
 */
export function generateClaimEvidencePackagePDF(data: ClaimEvidencePackageData, options: ClaimPackageOptions = defaultPackageOptions): void {
  const startTime = Date.now()
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let yPos = margin

  // Helper to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage()
      yPos = margin
      return true
    }
    return false
  }

  // Helper to draw a line
  const drawLine = () => {
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 3
  }

  // Helper to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  // ========== COVER PAGE ==========
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('PROGRESS CLAIM', pageWidth / 2, 40, { align: 'center' })
  doc.text('EVIDENCE PACKAGE', pageWidth / 2, 52, { align: 'center' })

  doc.setFontSize(18)
  doc.text(`Claim #${data.claim.claimNumber}`, pageWidth / 2, 70, { align: 'center' })

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(data.project.name, pageWidth / 2, 85, { align: 'center' })
  if (data.project.projectNumber) {
    doc.text(`Project #: ${data.project.projectNumber}`, pageWidth / 2, 95, { align: 'center' })
  }

  // Claim period
  doc.setFontSize(12)
  const periodStart = new Date(data.claim.periodStart).toLocaleDateString('en-AU')
  const periodEnd = new Date(data.claim.periodEnd).toLocaleDateString('en-AU')
  doc.text(`Claim Period: ${periodStart} - ${periodEnd}`, pageWidth / 2, 115, { align: 'center' })

  // Summary box
  doc.setFillColor(245, 245, 245)
  doc.rect(margin, 130, contentWidth, 50, 'F')

  doc.setFont('helvetica', 'bold')
  doc.text('Claim Summary', margin + 5, 140)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`Total Lots: ${data.summary.totalLots}`, margin + 5, 150)
  doc.text(`Claimed Amount: ${formatCurrency(data.summary.totalClaimedAmount)}`, margin + 5, 158)
  doc.text(`Test Results: ${data.summary.totalTestResults} (${data.summary.totalPassedTests} passed)`, margin + 5, 166)
  doc.text(`NCRs: ${data.summary.totalNCRs} (${data.summary.totalOpenNCRs} open)`, margin + 5, 174)

  doc.text(`Photos: ${data.summary.totalPhotos}`, margin + contentWidth / 2, 150)
  doc.text(`Conformed Lots: ${data.summary.conformedLots}`, margin + contentWidth / 2, 158)
  doc.text(`Status: ${data.claim.status.toUpperCase()}`, margin + contentWidth / 2, 166)

  // Prepared by
  if (data.claim.preparedBy) {
    doc.setFontSize(10)
    doc.text(`Prepared by: ${data.claim.preparedBy.name}`, margin, 195)
    if (data.claim.preparedAt) {
      const preparedDate = new Date(data.claim.preparedAt).toLocaleDateString('en-AU')
      doc.text(`Date: ${preparedDate}`, margin, 203)
    }
  }

  // SOPA Compliance note
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text('This evidence package is prepared for Security of Payment Act compliance.', pageWidth / 2, 240, { align: 'center' })
  doc.text(`State: ${data.project.state || 'NSW'}`, pageWidth / 2, 248, { align: 'center' })

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  const generatedDate = new Date(data.generatedAt).toLocaleString('en-AU')
  doc.text(`Generated: ${generatedDate}`, margin, pageHeight - 15)
  doc.text('SiteProof v2 - Civil Execution and Conformance Platform', pageWidth - margin, pageHeight - 15, { align: 'right' })

  // ========== LOT SUMMARY TABLE (Page 2) ==========
  if (options.includeLotSummary) {
    doc.addPage()
    yPos = margin

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('LOT SUMMARY', margin, yPos)
    yPos += 10

    // Table header
    const headers = ['Lot #', 'Activity', 'Status', 'ITP %', 'Tests', 'NCRs', 'Claim Amount']
    const colWidths = [25, 45, 22, 18, 18, 18, 34]

    doc.setFillColor(240, 240, 240)
    doc.rect(margin, yPos, contentWidth, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    let xPos = margin + 2
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5.5)
      xPos += colWidths[i]
    })
    yPos += 10

    // Table rows
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)

    data.lots.forEach((lot, idx) => {
      checkPageBreak(8)

      // Alternate row colors
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250)
        doc.rect(margin, yPos - 1, contentWidth, 7, 'F')
      }

      xPos = margin + 2
      doc.text(lot.lotNumber.slice(0, 12), xPos, yPos + 4)
      xPos += colWidths[0]

      doc.text((lot.activityType || 'N/A').slice(0, 25), xPos, yPos + 4)
      xPos += colWidths[1]

      doc.text(lot.status.slice(0, 10), xPos, yPos + 4)
      xPos += colWidths[2]

      doc.text(`${lot.summary.itpCompletionPercentage}%`, xPos, yPos + 4)
      xPos += colWidths[3]

      doc.text(`${lot.summary.passedTestCount}/${lot.summary.testResultCount}`, xPos, yPos + 4)
      xPos += colWidths[4]

      doc.text(`${lot.summary.ncrCount}`, xPos, yPos + 4)
      xPos += colWidths[5]

      doc.text(formatCurrency(lot.claimAmount), xPos, yPos + 4)

      yPos += 7
    })

    // Total row
    yPos += 3
    doc.setFillColor(220, 220, 220)
    doc.rect(margin, yPos - 1, contentWidth, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL', margin + 2, yPos + 5)
    doc.text(`${data.lots.length} lots`, margin + colWidths[0] + colWidths[1] + 2, yPos + 5)
    doc.text(formatCurrency(data.summary.totalClaimedAmount), margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + 2, yPos + 5)
    yPos += 15
  }

  // ========== INDIVIDUAL LOT DETAILS ==========
  if (options.includeLotDetails) {
    data.lots.forEach((lot, lotIdx) => {
      // Each lot starts on a new page (or at least has enough space)
      if (lotIdx > 0 || yPos > pageHeight - 100) {
        doc.addPage()
        yPos = margin
      } else {
        checkPageBreak(80)
      }

      // Lot header
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text(`LOT: ${lot.lotNumber}`, margin, yPos)
      yPos += 6

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      if (lot.description) {
        doc.text(lot.description.slice(0, 80), margin, yPos)
        yPos += 5
      }
      if (lot.activityType) {
        doc.text(`Activity: ${lot.activityType}`, margin, yPos)
        yPos += 5
      }
      if (lot.chainageStart !== null && lot.chainageEnd !== null) {
        doc.text(`Chainage: ${lot.chainageStart} - ${lot.chainageEnd}`, margin, yPos)
        yPos += 5
      }
      if (lot.layer) {
        doc.text(`Layer: ${lot.layer}`, margin, yPos)
        yPos += 5
      }

      // Status badge
      doc.text(`Status: ${lot.status} | Claim Amount: ${formatCurrency(lot.claimAmount)}`, margin, yPos)
      yPos += 8

      drawLine()

      // ITP Summary (conditional)
      if (options.includeITPChecklists && lot.itp) {
        checkPageBreak(25)
        doc.setFont('helvetica', 'bold')
        doc.text('ITP Checklist', margin, yPos)
        yPos += 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(`Template: ${lot.itp.templateName}`, margin, yPos)
        yPos += 4
        const completedItems = lot.itp.completions.filter((c: any) => c.isCompleted).length
        const totalItems = lot.itp.checklistItems.length
        doc.text(`Completion: ${completedItems}/${totalItems} items (${lot.summary.itpCompletionPercentage}%)`, margin, yPos)
        yPos += 4

        // Hold points (conditional)
        if (options.includeHoldPoints) {
          const releasedHP = lot.itp.holdPoints.filter((hp: any) => hp.status === 'released').length
          const totalHP = lot.itp.holdPoints.length
          if (totalHP > 0) {
            doc.text(`Hold Points: ${releasedHP}/${totalHP} released`, margin, yPos)
            yPos += 4
          }
        }
        yPos += 4
      }

      // Test Results Summary (conditional)
      if (options.includeTestResults && lot.testResults.length > 0) {
        checkPageBreak(20)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('Test Results', margin, yPos)
        yPos += 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(`Total: ${lot.summary.testResultCount} | Passed: ${lot.summary.passedTestCount} | Failed: ${lot.summary.testResultCount - lot.summary.passedTestCount}`, margin, yPos)
        yPos += 6

        // List first few test results
        lot.testResults.slice(0, 5).forEach((test: any) => {
          checkPageBreak(6)
          const passFail = test.passFail === 'pass' ? '✓' : test.passFail === 'fail' ? '✗' : '-'
          const result = test.resultValue !== null ? `${test.resultValue} ${test.resultUnit || ''}` : 'pending'
          doc.text(`  ${passFail} ${test.testType}: ${result}`, margin, yPos)
          yPos += 4
        })
        if (lot.testResults.length > 5) {
          doc.setFont('helvetica', 'italic')
          doc.text(`  ... and ${lot.testResults.length - 5} more tests`, margin, yPos)
          doc.setFont('helvetica', 'normal')
          yPos += 4
        }
        yPos += 4
      }

      // NCR Summary (conditional)
      if (options.includeNCRs && lot.ncrs.length > 0) {
        checkPageBreak(20)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('Non-Conformance Reports', margin, yPos)
        yPos += 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(`Total: ${lot.summary.ncrCount} | Open: ${lot.summary.openNcrCount} | Closed: ${lot.summary.ncrCount - lot.summary.openNcrCount}`, margin, yPos)
        yPos += 6

        // List NCRs
        lot.ncrs.slice(0, 3).forEach((ncr: any) => {
          checkPageBreak(6)
          doc.text(`  ${ncr.ncrNumber} (${ncr.severity}): ${ncr.status}`, margin, yPos)
          yPos += 4
        })
        if (lot.ncrs.length > 3) {
          doc.setFont('helvetica', 'italic')
          doc.text(`  ... and ${lot.ncrs.length - 3} more NCRs`, margin, yPos)
          doc.setFont('helvetica', 'normal')
          yPos += 4
        }
        yPos += 4
      }

      // Conformance
      if (lot.conformedAt) {
        checkPageBreak(15)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('Conformance', margin, yPos)
        yPos += 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        const conformedDate = new Date(lot.conformedAt).toLocaleDateString('en-AU')
        doc.text(`Conformed: ${conformedDate}`, margin, yPos)
        yPos += 4
        if (lot.conformedBy) {
          doc.text(`By: ${lot.conformedBy.name}`, margin, yPos)
          yPos += 4
        }
        yPos += 4
      }

      // Photo count (conditional)
      if (options.includePhotos && lot.summary.photoCount > 0) {
        checkPageBreak(10)
        doc.setFontSize(9)
        doc.text(`Photos: ${lot.summary.photoCount} attached to lot`, margin, yPos)
        yPos += 8
      }

      drawLine()
      yPos += 5
    })
  }

  // ========== FINAL PAGE - DECLARATION ==========
  if (options.includeDeclaration) {
    doc.addPage()
    yPos = margin

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('DECLARATION', margin, yPos)
    yPos += 12

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('This evidence package contains the supporting documentation for Progress Claim', margin, yPos)
    yPos += 5
    doc.text(`#${data.claim.claimNumber} in the amount of ${formatCurrency(data.summary.totalClaimedAmount)}.`, margin, yPos)
    yPos += 12

    doc.text('The information provided in this package is true and accurate to the best of our', margin, yPos)
    yPos += 5
    doc.text('knowledge. All lots included have been completed in accordance with the contract', margin, yPos)
    yPos += 5
    doc.text('requirements and applicable standards.', margin, yPos)
    yPos += 20

    // Signature lines
    doc.line(margin, yPos, margin + 60, yPos)
    yPos += 5
    doc.text('Signature', margin, yPos)
    yPos += 15

    doc.line(margin, yPos, margin + 60, yPos)
    yPos += 5
    doc.text('Name', margin, yPos)
    yPos += 15

    doc.line(margin, yPos, margin + 60, yPos)
    yPos += 5
    doc.text('Date', margin, yPos)
    yPos += 25

    // Footer with generation info
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(`Evidence package generated: ${new Date(data.generatedAt).toLocaleString('en-AU')}`, margin, pageHeight - 25)
    doc.text(`Generation time: ${data.generationTimeMs}ms (data fetch) + ${Date.now() - startTime}ms (PDF)`, margin, pageHeight - 20)
    doc.text('SiteProof v2 - Civil Execution and Conformance Platform', margin, pageHeight - 15)
  }

  // Save the PDF
  const filename = `Claim-${data.claim.claimNumber}-Evidence-Package-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)

  console.log(`Claim evidence package PDF generated in ${Date.now() - startTime}ms`)
}

// ========================================
// NCR DETAIL PDF GENERATOR
// ========================================

export interface NCRDetailData {
  ncr: {
    ncrNumber: string
    description: string
    category: string
    severity: 'minor' | 'major'
    status: string
    rootCause?: string | null
    proposedAction?: string | null
    actionTaken?: string | null
    preventativeMeasures?: string | null
    qmApprovalRequired: boolean
    qmApprovedAt: string | null
    qmApprovedBy?: { fullName: string; email: string } | null
    raisedBy: { fullName: string; email: string }
    responsibleUser?: { fullName: string; email: string } | null
    dueDate?: string | null
    closedAt?: string | null
    closedBy?: { fullName: string; email: string } | null
    createdAt: string
  }
  project: {
    name: string
    projectNumber: string
  }
  lots: Array<{
    lotNumber: string
    description: string | null
  }>
  timeline?: Array<{
    action: string
    performedBy: string
    performedAt: string
    notes?: string
  }>
}

/**
 * Generate a PDF detail report for a Non-Conformance Report (NCR)
 */
export function generateNCRDetailPDF(data: NCRDetailData): void {
  const startTime = Date.now()
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - (margin * 2)
  let yPos = margin

  // Helper functions
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Not set'
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Not set'
    return new Date(dateStr).toLocaleString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const checkPageBreak = (neededHeight: number): void => {
    if (yPos + neededHeight > pageHeight - 20) {
      doc.addPage()
      yPos = margin
    }
  }

  const drawLine = (): void => {
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 3
  }

  const drawSectionHeader = (title: string): void => {
    checkPageBreak(15)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, yPos - 3, contentWidth, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(50, 50, 50)
    doc.text(title, margin + 2, yPos + 2)
    yPos += 10
    doc.setTextColor(0, 0, 0)
  }

  const addField = (label: string, value: string | null | undefined, maxWidth?: number): void => {
    checkPageBreak(8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`${label}:`, margin, yPos)
    doc.setFont('helvetica', 'normal')
    const labelWidth = doc.getTextWidth(`${label}: `)
    const valueText = value || 'N/A'
    const textMaxWidth = maxWidth || (contentWidth - labelWidth - 5)
    const lines = doc.splitTextToSize(valueText, textMaxWidth)
    doc.text(lines, margin + labelWidth + 2, yPos)
    yPos += (lines.length * 4) + 2
  }

  // ========== HEADER ==========
  // Severity-based header color
  const severityColors: Record<string, [number, number, number]> = {
    major: [220, 53, 69],   // Red for major
    minor: [255, 193, 7]    // Amber for minor
  }
  const headerColor = severityColors[data.ncr.severity] || [100, 100, 100]

  doc.setFillColor(...headerColor)
  doc.rect(0, 0, pageWidth, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('NON-CONFORMANCE REPORT', margin, 15)

  doc.setFontSize(12)
  doc.text(data.ncr.ncrNumber, margin, 25)

  // Severity badge in header
  doc.setFontSize(10)
  doc.text(`[${data.ncr.severity.toUpperCase()}]`, pageWidth - margin - 20, 25)

  yPos = 45
  doc.setTextColor(0, 0, 0)

  // ========== NCR IDENTIFICATION ==========
  drawSectionHeader('NCR Identification')

  addField('NCR Number', data.ncr.ncrNumber)
  addField('Status', data.ncr.status.replace(/_/g, ' ').toUpperCase())
  addField('Category', data.ncr.category.replace(/_/g, ' '))
  addField('Severity', data.ncr.severity.toUpperCase())
  addField('Raised By', data.ncr.raisedBy?.fullName || data.ncr.raisedBy?.email || 'Unknown')
  addField('Raised On', formatDateTime(data.ncr.createdAt))
  addField('Due Date', formatDate(data.ncr.dueDate))
  addField('Responsible', data.ncr.responsibleUser?.fullName || data.ncr.responsibleUser?.email || 'Unassigned')

  yPos += 5

  // ========== PROJECT & LOTS ==========
  drawSectionHeader('Project & Affected Lots')

  addField('Project', `${data.project.name} (${data.project.projectNumber})`)

  if (data.lots && data.lots.length > 0) {
    checkPageBreak(10 + data.lots.length * 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Affected Lots:', margin, yPos)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    data.lots.forEach(lot => {
      const lotText = lot.description ? `${lot.lotNumber} - ${lot.description}` : lot.lotNumber
      doc.text(`  • ${lotText}`, margin, yPos)
      yPos += 4
    })
  } else {
    addField('Affected Lots', 'None specified')
  }

  yPos += 5

  // ========== DESCRIPTION ==========
  drawSectionHeader('Non-Conformance Description')

  checkPageBreak(20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const descLines = doc.splitTextToSize(data.ncr.description || 'No description provided', contentWidth - 5)
  doc.text(descLines, margin, yPos)
  yPos += (descLines.length * 4) + 5

  // ========== ROOT CAUSE & ACTIONS ==========
  if (data.ncr.rootCause || data.ncr.proposedAction || data.ncr.actionTaken || data.ncr.preventativeMeasures) {
    drawSectionHeader('Investigation & Resolution')

    if (data.ncr.rootCause) {
      checkPageBreak(15)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Root Cause:', margin, yPos)
      yPos += 4
      doc.setFont('helvetica', 'normal')
      const rootCauseLines = doc.splitTextToSize(data.ncr.rootCause, contentWidth - 5)
      doc.text(rootCauseLines, margin + 3, yPos)
      yPos += (rootCauseLines.length * 4) + 4
    }

    if (data.ncr.proposedAction) {
      checkPageBreak(15)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Proposed Action:', margin, yPos)
      yPos += 4
      doc.setFont('helvetica', 'normal')
      const proposedLines = doc.splitTextToSize(data.ncr.proposedAction, contentWidth - 5)
      doc.text(proposedLines, margin + 3, yPos)
      yPos += (proposedLines.length * 4) + 4
    }

    if (data.ncr.actionTaken) {
      checkPageBreak(15)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Action Taken:', margin, yPos)
      yPos += 4
      doc.setFont('helvetica', 'normal')
      const actionLines = doc.splitTextToSize(data.ncr.actionTaken, contentWidth - 5)
      doc.text(actionLines, margin + 3, yPos)
      yPos += (actionLines.length * 4) + 4
    }

    if (data.ncr.preventativeMeasures) {
      checkPageBreak(15)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Preventative Measures:', margin, yPos)
      yPos += 4
      doc.setFont('helvetica', 'normal')
      const preventativeLines = doc.splitTextToSize(data.ncr.preventativeMeasures, contentWidth - 5)
      doc.text(preventativeLines, margin + 3, yPos)
      yPos += (preventativeLines.length * 4) + 4
    }

    yPos += 3
  }

  // ========== QM APPROVAL (for major NCRs) ==========
  if (data.ncr.severity === 'major') {
    drawSectionHeader('Quality Manager Approval')

    addField('QM Approval Required', data.ncr.qmApprovalRequired ? 'Yes' : 'No')
    if (data.ncr.qmApprovedAt) {
      addField('QM Approved', formatDateTime(data.ncr.qmApprovedAt))
      addField('Approved By', data.ncr.qmApprovedBy?.fullName || data.ncr.qmApprovedBy?.email || 'Unknown')
    } else if (data.ncr.qmApprovalRequired) {
      addField('QM Approval Status', 'Pending')
    }
    yPos += 3
  }

  // ========== CLOSURE DETAILS ==========
  if (data.ncr.closedAt) {
    drawSectionHeader('Closure Details')

    addField('Closed On', formatDateTime(data.ncr.closedAt))
    addField('Closed By', data.ncr.closedBy?.fullName || data.ncr.closedBy?.email || 'Unknown')
    yPos += 3
  }

  // ========== TIMELINE ==========
  if (data.timeline && data.timeline.length > 0) {
    drawSectionHeader('Activity Timeline')

    data.timeline.forEach((event, index) => {
      checkPageBreak(15)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(`${index + 1}. ${event.action}`, margin, yPos)
      yPos += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`   By: ${event.performedBy} | ${formatDateTime(event.performedAt)}`, margin, yPos)
      yPos += 4
      if (event.notes) {
        const noteLines = doc.splitTextToSize(`   Notes: ${event.notes}`, contentWidth - 10)
        doc.text(noteLines, margin, yPos)
        yPos += (noteLines.length * 3) + 2
      }
    })
    yPos += 3
  }

  // ========== FOOTER ==========
  const footerY = pageHeight - 15
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)

  doc.setFontSize(7)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generated from SiteProof v2 on ${new Date().toLocaleString('en-AU')}`, margin, footerY)
  doc.text('Civil Execution and Conformance Platform', pageWidth - margin - 50, footerY)

  // Save the PDF
  const filename = `NCR-${data.ncr.ncrNumber}-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)

  console.log(`NCR detail PDF generated in ${Date.now() - startTime}ms`)
}

// ========================================
// TEST CERTIFICATE PDF GENERATOR
// ========================================

export interface TestCertificateData {
  test: {
    id: string
    testType: string
    testRequestNumber: string | null
    laboratoryName: string | null
    laboratoryReportNumber: string | null
    sampleDate: string | null
    sampleLocation: string | null
    testDate: string | null
    resultDate: string | null
    resultValue: number | null
    resultUnit: string | null
    specificationMin: number | null
    specificationMax: number | null
    passFail: string
    status: string
    aiExtracted?: boolean
    createdAt: string
  }
  lot: {
    lotNumber: string
    description: string | null
    activityType: string | null
    chainageStart: number | null
    chainageEnd: number | null
  } | null
  project: {
    name: string
    projectNumber: string
  }
}

/**
 * Generate a PDF test certificate for a test result
 */
export function generateTestCertificatePDF(data: TestCertificateData): void {
  const startTime = Date.now()
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - (margin * 2)
  let yPos = margin

  // Helper functions
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Not recorded'
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const checkPageBreak = (neededHeight: number): void => {
    if (yPos + neededHeight > pageHeight - 20) {
      doc.addPage()
      yPos = margin
    }
  }

  const drawSectionHeader = (title: string): void => {
    checkPageBreak(15)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, yPos - 3, contentWidth, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(50, 50, 50)
    doc.text(title, margin + 2, yPos + 2)
    yPos += 10
    doc.setTextColor(0, 0, 0)
  }

  const addField = (label: string, value: string | null | undefined): void => {
    checkPageBreak(8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`${label}:`, margin, yPos)
    doc.setFont('helvetica', 'normal')
    const labelWidth = doc.getTextWidth(`${label}: `)
    doc.text(value || 'N/A', margin + labelWidth + 2, yPos)
    yPos += 6
  }

  // ========== HEADER ==========
  // Pass/Fail based header color
  const passFailColors: Record<string, [number, number, number]> = {
    pass: [34, 197, 94],   // Green
    fail: [239, 68, 68],    // Red
    pending: [234, 179, 8]  // Amber
  }
  const headerColor = passFailColors[data.test.passFail.toLowerCase()] || [100, 100, 100]

  doc.setFillColor(...headerColor)
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('TEST CERTIFICATE', margin, 15)

  doc.setFontSize(12)
  doc.text(data.test.testType, margin, 27)

  // Pass/Fail badge
  const passFailText = data.test.passFail.toUpperCase()
  doc.setFontSize(14)
  const badgeX = pageWidth - margin - doc.getTextWidth(passFailText)
  doc.text(passFailText, badgeX, 27)

  yPos = 50
  doc.setTextColor(0, 0, 0)

  // ========== TEST IDENTIFICATION ==========
  drawSectionHeader('Test Identification')

  addField('Test Type', data.test.testType)
  addField('Request Number', data.test.testRequestNumber)
  addField('Lab Report Number', data.test.laboratoryReportNumber)
  addField('Laboratory', data.test.laboratoryName)
  addField('Status', data.test.status.replace(/_/g, ' ').toUpperCase())
  if (data.test.aiExtracted) {
    addField('Data Source', 'AI Extracted from Certificate')
  }

  yPos += 5

  // ========== PROJECT & LOT ==========
  drawSectionHeader('Project & Location')

  addField('Project', `${data.project.name} (${data.project.projectNumber})`)
  if (data.lot) {
    addField('Lot Number', data.lot.lotNumber)
    addField('Lot Description', data.lot.description)
    addField('Activity Type', data.lot.activityType)
    if (data.lot.chainageStart != null) {
      const chainageText = data.lot.chainageEnd != null
        ? `CH ${data.lot.chainageStart} - ${data.lot.chainageEnd}`
        : `CH ${data.lot.chainageStart}`
      addField('Chainage', chainageText)
    }
  } else {
    addField('Lot', 'Not linked')
  }
  addField('Sample Location', data.test.sampleLocation)

  yPos += 5

  // ========== DATES ==========
  drawSectionHeader('Test Dates')

  addField('Sample Date', formatDate(data.test.sampleDate))
  addField('Test Date', formatDate(data.test.testDate))
  addField('Result Date', formatDate(data.test.resultDate))
  addField('Record Created', formatDate(data.test.createdAt))

  yPos += 5

  // ========== TEST RESULTS ==========
  drawSectionHeader('Test Results')

  // Result value box
  checkPageBreak(40)
  doc.setFillColor(245, 245, 245)
  doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'F')

  // Result value
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  const resultText = data.test.resultValue != null
    ? `${data.test.resultValue}${data.test.resultUnit ? ' ' + data.test.resultUnit : ''}`
    : 'Pending'
  doc.text(resultText, margin + 10, yPos + 15)

  // Specification range
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (data.test.specificationMin != null || data.test.specificationMax != null) {
    let specText = 'Specification: '
    if (data.test.specificationMin != null && data.test.specificationMax != null) {
      specText += `${data.test.specificationMin} - ${data.test.specificationMax}${data.test.resultUnit ? ' ' + data.test.resultUnit : ''}`
    } else if (data.test.specificationMin != null) {
      specText += `≥ ${data.test.specificationMin}${data.test.resultUnit ? ' ' + data.test.resultUnit : ''}`
    } else if (data.test.specificationMax != null) {
      specText += `≤ ${data.test.specificationMax}${data.test.resultUnit ? ' ' + data.test.resultUnit : ''}`
    }
    doc.text(specText, margin + 10, yPos + 25)
  }

  // Pass/Fail indicator
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  const passFailIndicator = data.test.passFail.toUpperCase()
  const indicatorColor = passFailColors[data.test.passFail.toLowerCase()] || [100, 100, 100]
  doc.setTextColor(...indicatorColor)
  doc.text(passFailIndicator, margin + contentWidth - 40, yPos + 20)
  doc.setTextColor(0, 0, 0)

  yPos += 45

  // ========== COMPLIANCE STATEMENT ==========
  checkPageBreak(30)
  doc.setFillColor(data.test.passFail.toLowerCase() === 'pass' ? 220 : 254, data.test.passFail.toLowerCase() === 'pass' ? 252 : 226, data.test.passFail.toLowerCase() === 'pass' ? 231 : 226)
  doc.roundedRect(margin, yPos, contentWidth, 20, 3, 3, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(data.test.passFail.toLowerCase() === 'pass' ? 22 : 153, data.test.passFail.toLowerCase() === 'pass' ? 163 : 27, data.test.passFail.toLowerCase() === 'pass' ? 74 : 27)

  const complianceText = data.test.passFail.toLowerCase() === 'pass'
    ? '✓ This test result COMPLIES with the specified requirements.'
    : data.test.passFail.toLowerCase() === 'fail'
    ? '✗ This test result DOES NOT COMPLY with the specified requirements.'
    : '⏳ Test result is pending evaluation.'

  doc.text(complianceText, margin + 10, yPos + 12)
  doc.setTextColor(0, 0, 0)

  yPos += 30

  // ========== SIGNATURE AREA ==========
  checkPageBreak(50)
  yPos += 10

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Verified By:', margin, yPos)
  yPos += 15
  doc.line(margin, yPos, margin + 60, yPos)
  yPos += 5
  doc.text('Signature', margin, yPos)

  doc.text('Date:', margin + 100, yPos - 20)
  doc.line(margin + 100, yPos - 5, margin + 160, yPos - 5)

  // ========== FOOTER ==========
  const footerY = pageHeight - 15
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)

  doc.setFontSize(7)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generated from SiteProof v2 on ${new Date().toLocaleString('en-AU')}`, margin, footerY)
  doc.text('Civil Execution and Conformance Platform', pageWidth - margin - 50, footerY)

  // Save the PDF
  const filename = `Test-Certificate-${data.test.testRequestNumber || data.test.id}-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)

  console.log(`Test certificate PDF generated in ${Date.now() - startTime}ms`)
}

// ========================================
// DAILY DIARY PDF GENERATOR
// ========================================

export interface DailyDiaryPDFData {
  diary: {
    id: string
    date: string
    status: 'draft' | 'submitted'
    weatherConditions?: string | null
    temperatureMin?: number | null
    temperatureMax?: number | null
    rainfallMm?: number | null
    weatherNotes?: string | null
    generalNotes?: string | null
    isLate?: boolean
    submittedBy?: { fullName: string; email: string } | null
    submittedAt?: string | null
    createdAt: string
    updatedAt: string
  }
  project: {
    name: string
    projectNumber: string | null
  }
  personnel: Array<{
    id: string
    name: string
    company?: string | null
    role?: string | null
    startTime?: string | null
    finishTime?: string | null
    hours?: number | null
  }>
  plant: Array<{
    id: string
    description: string
    idRego?: string | null
    company?: string | null
    hoursOperated?: number | null
    notes?: string | null
  }>
  activities: Array<{
    id: string
    description: string
    lot?: { lotNumber: string } | null
    quantity?: number | null
    unit?: string | null
    notes?: string | null
  }>
  delays: Array<{
    id: string
    delayType: string
    description: string
    startTime?: string | null
    endTime?: string | null
    durationHours?: number | null
    impact?: string | null
  }>
  addendums?: Array<{
    id: string
    content: string
    addedBy: { fullName: string; email: string }
    addedAt: string
  }>
}

/**
 * Generate a PDF daily diary report
 */
export function generateDailyDiaryPDF(data: DailyDiaryPDFData): void {
  const startTime = Date.now()
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - (margin * 2)
  let yPos = margin

  // Helper functions
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Not set'
    return new Date(dateStr).toLocaleDateString('en-AU', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Not set'
    return new Date(dateStr).toLocaleString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const checkPageBreak = (neededHeight: number): void => {
    if (yPos + neededHeight > pageHeight - 20) {
      doc.addPage()
      yPos = margin
    }
  }

  const drawLine = (): void => {
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 3
  }

  const drawSectionHeader = (title: string): void => {
    checkPageBreak(15)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, yPos - 3, contentWidth, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(50, 50, 50)
    doc.text(title, margin + 2, yPos + 2)
    yPos += 10
    doc.setTextColor(0, 0, 0)
  }

  const addField = (label: string, value: string | null | undefined): void => {
    checkPageBreak(8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`${label}:`, margin, yPos)
    doc.setFont('helvetica', 'normal')
    const labelWidth = doc.getTextWidth(`${label}: `)
    doc.text(value || 'N/A', margin + labelWidth + 2, yPos)
    yPos += 6
  }

  // ========== HEADER ==========
  // Status-based header color
  const isSubmitted = data.diary.status === 'submitted'
  const headerColor: [number, number, number] = isSubmitted ? [34, 197, 94] : [234, 179, 8]

  doc.setFillColor(...headerColor)
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('DAILY DIARY', margin, 15)

  doc.setFontSize(12)
  doc.text(formatDate(data.diary.date), margin, 27)

  // Status badge
  doc.setFontSize(10)
  const statusText = data.diary.status.toUpperCase() + (data.diary.isLate ? ' (LATE)' : '')
  const badgeX = pageWidth - margin - doc.getTextWidth(statusText)
  doc.text(statusText, badgeX, 27)

  yPos = 50
  doc.setTextColor(0, 0, 0)

  // ========== PROJECT INFO ==========
  drawSectionHeader('Project Information')

  addField('Project', data.project.name)
  if (data.project.projectNumber) {
    addField('Project Number', data.project.projectNumber)
  }
  addField('Diary Date', formatDate(data.diary.date))
  addField('Status', data.diary.status === 'submitted' ? 'Submitted' : 'Draft')

  if (data.diary.submittedBy && data.diary.submittedAt) {
    addField('Submitted By', data.diary.submittedBy.fullName || data.diary.submittedBy.email)
    addField('Submitted At', formatDateTime(data.diary.submittedAt))
  }

  yPos += 5

  // ========== WEATHER ==========
  drawSectionHeader('Weather Conditions')

  addField('Conditions', data.diary.weatherConditions)
  if (data.diary.temperatureMin != null || data.diary.temperatureMax != null) {
    const tempText = `${data.diary.temperatureMin ?? '-'}°C to ${data.diary.temperatureMax ?? '-'}°C`
    addField('Temperature', tempText)
  }
  if (data.diary.rainfallMm != null) {
    addField('Rainfall', `${data.diary.rainfallMm} mm`)
  }
  if (data.diary.weatherNotes) {
    addField('Weather Notes', data.diary.weatherNotes)
  }

  yPos += 5

  // ========== GENERAL NOTES ==========
  if (data.diary.generalNotes) {
    drawSectionHeader('General Notes')

    checkPageBreak(20)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    // Strip HTML tags for plain text in PDF
    const plainNotes = data.diary.generalNotes.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const noteLines = doc.splitTextToSize(plainNotes, contentWidth - 5)
    doc.text(noteLines, margin, yPos)
    yPos += (noteLines.length * 4) + 5
  }

  // ========== PERSONNEL ==========
  drawSectionHeader(`Personnel on Site (${data.personnel.length})`)

  if (data.personnel.length > 0) {
    // Table header
    const personnelHeaders = ['Name', 'Company', 'Role', 'Start', 'Finish', 'Hours']
    const personnelColWidths = [40, 35, 30, 20, 20, 20]

    checkPageBreak(10)
    doc.setFillColor(245, 245, 245)
    doc.rect(margin, yPos, contentWidth, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    let xPos = margin + 2
    personnelHeaders.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5)
      xPos += personnelColWidths[i]
    })
    yPos += 9

    // Table rows
    doc.setFont('helvetica', 'normal')
    data.personnel.forEach((person) => {
      checkPageBreak(7)
      xPos = margin + 2

      doc.text((person.name || 'N/A').slice(0, 22), xPos, yPos + 4)
      xPos += personnelColWidths[0]

      doc.text((person.company || '-').slice(0, 18), xPos, yPos + 4)
      xPos += personnelColWidths[1]

      doc.text((person.role || '-').slice(0, 16), xPos, yPos + 4)
      xPos += personnelColWidths[2]

      doc.text(person.startTime || '-', xPos, yPos + 4)
      xPos += personnelColWidths[3]

      doc.text(person.finishTime || '-', xPos, yPos + 4)
      xPos += personnelColWidths[4]

      doc.text(person.hours != null ? person.hours.toString() : '-', xPos, yPos + 4)

      yPos += 6
    })

    // Personnel subtotals by company
    const companyTotals: Record<string, { count: number; hours: number }> = {}
    data.personnel.forEach(p => {
      const company = p.company || 'Unspecified'
      if (!companyTotals[company]) {
        companyTotals[company] = { count: 0, hours: 0 }
      }
      companyTotals[company].count++
      companyTotals[company].hours += (typeof p.hours === 'number' ? p.hours : 0)
    })

    checkPageBreak(15)
    yPos += 3
    doc.setFillColor(250, 250, 250)
    doc.rect(margin, yPos, contentWidth, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)

    let subtotalText = 'Subtotals: '
    Object.entries(companyTotals).forEach(([company, data], idx) => {
      if (idx > 0) subtotalText += ' | '
      subtotalText += `${company}: ${data.count} (${data.hours.toFixed(1)}h)`
    })

    const totalHours = data.personnel.reduce((sum, p) => sum + (typeof p.hours === 'number' ? p.hours : 0), 0)
    doc.text(subtotalText.slice(0, 90), margin + 2, yPos + 5)
    doc.text(`TOTAL: ${data.personnel.length} people, ${totalHours.toFixed(1)} hrs`, pageWidth - margin - 50, yPos + 5)
    yPos += 12
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.text('No personnel recorded.', margin, yPos)
    yPos += 8
  }

  // ========== PLANT & EQUIPMENT ==========
  drawSectionHeader(`Plant & Equipment (${data.plant.length})`)

  if (data.plant.length > 0) {
    // Table header
    const plantHeaders = ['Description', 'ID/Rego', 'Company', 'Hours', 'Notes']
    const plantColWidths = [50, 25, 30, 20, 45]

    checkPageBreak(10)
    doc.setFillColor(245, 245, 245)
    doc.rect(margin, yPos, contentWidth, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    let xPos = margin + 2
    plantHeaders.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5)
      xPos += plantColWidths[i]
    })
    yPos += 9

    // Table rows
    doc.setFont('helvetica', 'normal')
    data.plant.forEach((item) => {
      checkPageBreak(7)
      xPos = margin + 2

      doc.text((item.description || 'N/A').slice(0, 28), xPos, yPos + 4)
      xPos += plantColWidths[0]

      doc.text((item.idRego || '-').slice(0, 12), xPos, yPos + 4)
      xPos += plantColWidths[1]

      doc.text((item.company || '-').slice(0, 16), xPos, yPos + 4)
      xPos += plantColWidths[2]

      doc.text(item.hoursOperated != null ? item.hoursOperated.toString() : '-', xPos, yPos + 4)
      xPos += plantColWidths[3]

      doc.text((item.notes || '-').slice(0, 25), xPos, yPos + 4)

      yPos += 6
    })
    yPos += 5
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.text('No plant or equipment recorded.', margin, yPos)
    yPos += 8
  }

  // ========== ACTIVITIES ==========
  drawSectionHeader(`Activities (${data.activities.length})`)

  if (data.activities.length > 0) {
    // Table header
    const actHeaders = ['Description', 'Lot', 'Qty', 'Unit', 'Notes']
    const actColWidths = [60, 25, 20, 20, 45]

    checkPageBreak(10)
    doc.setFillColor(245, 245, 245)
    doc.rect(margin, yPos, contentWidth, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    let xPos = margin + 2
    actHeaders.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5)
      xPos += actColWidths[i]
    })
    yPos += 9

    // Table rows
    doc.setFont('helvetica', 'normal')
    data.activities.forEach((activity) => {
      checkPageBreak(7)
      xPos = margin + 2

      doc.text((activity.description || 'N/A').slice(0, 35), xPos, yPos + 4)
      xPos += actColWidths[0]

      doc.text(activity.lot?.lotNumber?.slice(0, 12) || '-', xPos, yPos + 4)
      xPos += actColWidths[1]

      doc.text(activity.quantity != null ? activity.quantity.toString() : '-', xPos, yPos + 4)
      xPos += actColWidths[2]

      doc.text((activity.unit || '-').slice(0, 10), xPos, yPos + 4)
      xPos += actColWidths[3]

      doc.text((activity.notes || '-').slice(0, 25), xPos, yPos + 4)

      yPos += 6
    })
    yPos += 5
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.text('No activities recorded.', margin, yPos)
    yPos += 8
  }

  // ========== DELAYS ==========
  drawSectionHeader(`Delays (${data.delays.length})`)

  if (data.delays.length > 0) {
    // Table header
    const delayHeaders = ['Type', 'Description', 'Start', 'End', 'Duration', 'Impact']
    const delayColWidths = [25, 55, 20, 20, 20, 30]

    checkPageBreak(10)
    doc.setFillColor(245, 245, 245)
    doc.rect(margin, yPos, contentWidth, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    let xPos = margin + 2
    delayHeaders.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5)
      xPos += delayColWidths[i]
    })
    yPos += 9

    // Table rows
    doc.setFont('helvetica', 'normal')
    data.delays.forEach((delay) => {
      checkPageBreak(7)
      xPos = margin + 2

      doc.text((delay.delayType || 'N/A').slice(0, 14), xPos, yPos + 4)
      xPos += delayColWidths[0]

      doc.text((delay.description || '-').slice(0, 32), xPos, yPos + 4)
      xPos += delayColWidths[1]

      doc.text(delay.startTime || '-', xPos, yPos + 4)
      xPos += delayColWidths[2]

      doc.text(delay.endTime || '-', xPos, yPos + 4)
      xPos += delayColWidths[3]

      doc.text(delay.durationHours != null ? `${delay.durationHours}h` : '-', xPos, yPos + 4)
      xPos += delayColWidths[4]

      doc.text((delay.impact || '-').slice(0, 18), xPos, yPos + 4)

      yPos += 6
    })

    // Total delay hours
    const totalDelayHours = data.delays.reduce((sum, d) => sum + (d.durationHours || 0), 0)
    if (totalDelayHours > 0) {
      yPos += 2
      doc.setFont('helvetica', 'bold')
      doc.text(`Total Delay: ${totalDelayHours.toFixed(1)} hours`, margin, yPos + 4)
      yPos += 8
    }
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.text('No delays recorded.', margin, yPos)
    yPos += 8
  }

  // ========== ADDENDUMS (for submitted diaries) ==========
  if (data.addendums && data.addendums.length > 0) {
    drawSectionHeader(`Addendums (${data.addendums.length})`)

    data.addendums.forEach((addendum, idx) => {
      checkPageBreak(20)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(`Addendum ${idx + 1}`, margin, yPos)
      yPos += 4

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`By: ${addendum.addedBy.fullName || addendum.addedBy.email} on ${formatDateTime(addendum.addedAt)}`, margin, yPos)
      yPos += 4

      doc.setFontSize(9)
      const addendumLines = doc.splitTextToSize(addendum.content, contentWidth - 5)
      doc.text(addendumLines, margin, yPos)
      yPos += (addendumLines.length * 4) + 5
    })
  }

  // ========== SUMMARY BOX ==========
  checkPageBreak(35)
  yPos += 5
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, yPos, contentWidth, 25, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Daily Summary', margin + 5, yPos + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const totalPersonnelHours = data.personnel.reduce((sum, p) => sum + (typeof p.hours === 'number' ? p.hours : 0), 0)
  const totalPlantHours = data.plant.reduce((sum, p) => sum + (p.hoursOperated || 0), 0)
  const totalDelays = data.delays.reduce((sum, d) => sum + (d.durationHours || 0), 0)

  doc.text(`Personnel: ${data.personnel.length} (${totalPersonnelHours.toFixed(1)} hrs)`, margin + 5, yPos + 15)
  doc.text(`Plant: ${data.plant.length} items (${totalPlantHours.toFixed(1)} hrs)`, margin + 60, yPos + 15)
  doc.text(`Activities: ${data.activities.length}`, margin + 120, yPos + 15)
  doc.text(`Delays: ${data.delays.length} (${totalDelays.toFixed(1)} hrs)`, margin + 5, yPos + 22)

  yPos += 35

  // ========== FOOTER ==========
  const footerY = pageHeight - 15
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)

  doc.setFontSize(7)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generated from SiteProof v2 on ${new Date().toLocaleString('en-AU')}`, margin, footerY)
  doc.text('Civil Execution and Conformance Platform', pageWidth - margin - 50, footerY)

  // Save the PDF
  const diaryDate = data.diary.date.split('T')[0]
  const filename = `Daily-Diary-${diaryDate}-${data.diary.status}.pdf`
  doc.save(filename)

  console.log(`Daily diary PDF generated in ${Date.now() - startTime}ms`)
}

export type { ConformanceReportData, HPEvidencePackageData, ClaimEvidencePackageData, NCRDetailData, TestCertificateData, DailyDiaryPDFData }
