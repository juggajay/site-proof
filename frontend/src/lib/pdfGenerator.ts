import { jsPDF } from 'jspdf'

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
    contractNumber: string | null
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
 */
export function generateConformanceReportPDF(data: ConformanceReportData): void {
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
  doc.text('LOT CONFORMANCE REPORT', pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

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
  if (data.project.contractNumber) {
    doc.text(`Contract #: ${data.project.contractNumber}`, margin, yPos)
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
  doc.text('This report was generated by SiteProof v2 - Construction Quality Management System', margin, yPos)

  // Save the PDF
  const filename = `Conformance-Report-${data.lot.lotNumber}-${new Date().toISOString().split('T')[0]}.pdf`
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

export type { ConformanceReportData, HPEvidencePackageData }
