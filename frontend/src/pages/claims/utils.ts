/**
 * Utility functions for Claims-related pages and components.
 * Extracted from ClaimsPage.tsx for reusability.
 */

import type { Claim, CertificationDueStatus, PaymentDueStatus, ConformedLot } from './types'
import { SOPA_TIMEFRAMES } from './constants'

/** Format a number as AUD currency, or return '-' for null */
export function formatCurrency(amount: number | null): string {
  if (amount === null) return '-'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0
  }).format(amount)
}

/** Calculate business days from a date (skipping weekends) */
export function addBusinessDays(startDate: Date, days: number): Date {
  const currentDate = new Date(startDate)
  let businessDays = days

  while (businessDays > 0) {
    currentDate.setDate(currentDate.getDate() + 1)
    const dayOfWeek = currentDate.getDay()
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays--
    }
  }

  return currentDate
}

/** Calculate certification due date based on SOPA response timeframes */
export function calculateCertificationDueDate(submittedAt: string, state: string = 'NSW'): string {
  const timeframe = SOPA_TIMEFRAMES[state] || SOPA_TIMEFRAMES.NSW
  const submissionDate = new Date(submittedAt)
  return addBusinessDays(submissionDate, timeframe.responseTime).toISOString()
}

/** Calculate payment due date based on SOPA timeframes */
export function calculatePaymentDueDate(submittedAt: string, state: string = 'NSW'): string {
  const timeframe = SOPA_TIMEFRAMES[state] || SOPA_TIMEFRAMES.NSW
  const submissionDate = new Date(submittedAt)
  return addBusinessDays(submissionDate, timeframe.paymentTime).toISOString()
}

/** Get certification due status - only for submitted claims awaiting certification */
export function getCertificationDueStatus(claim: Claim): CertificationDueStatus | null {
  // Only show certification due for submitted claims (not yet certified/paid)
  if (!claim.submittedAt || claim.status !== 'submitted') {
    return null
  }

  const dueDate = calculateCertificationDueDate(claim.submittedAt)
  const now = new Date()
  const due = new Date(dueDate)
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilDue < 0) {
    return { text: `Certification overdue by ${Math.abs(daysUntilDue)} days`, className: 'text-red-600 font-semibold', isOverdue: true }
  } else if (daysUntilDue <= 3) {
    return { text: `Certification due in ${daysUntilDue} days`, className: 'text-amber-600', isOverdue: false }
  } else {
    return { text: `Cert due ${due.toLocaleDateString('en-AU')}`, className: 'text-muted-foreground', isOverdue: false }
  }
}

/** Get payment due status for claims that have been submitted */
export function getPaymentDueStatus(claim: Claim): PaymentDueStatus | null {
  if (!claim.submittedAt || claim.status === 'draft' || claim.status === 'paid') {
    return null
  }

  const dueDate = calculatePaymentDueDate(claim.submittedAt)
  const now = new Date()
  const due = new Date(dueDate)
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilDue < 0) {
    return { text: `Overdue by ${Math.abs(daysUntilDue)} days`, className: 'text-red-600' }
  } else if (daysUntilDue <= 3) {
    return { text: `Due in ${daysUntilDue} days`, className: 'text-amber-600' }
  } else {
    return { text: `Due ${due.toLocaleDateString('en-AU')}`, className: 'text-muted-foreground' }
  }
}

/** Calculate claim amount for a lot based on percent complete */
export function calculateLotClaimAmount(lot: ConformedLot): number {
  return lot.budgetAmount * (lot.percentComplete / 100)
}

/** Export data as CSV file download */
export function exportChartDataToCSV(data: Record<string, unknown>[], filename: string, headers: string[]): void {
  // Build CSV content
  const csvRows = [headers.join(',')]

  data.forEach(row => {
    const values = headers.map(header => {
      // Convert header to camelCase key
      const key = header.toLowerCase().replace(/ /g, '')
      const value = row[key] ?? row[header.toLowerCase()] ?? ''
      // Escape values that contain commas
      return typeof value === 'string' && value.includes(',')
        ? `"${value}"`
        : value
    })
    csvRows.push(values.join(','))
  })

  const csvContent = csvRows.join('\n')

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
