import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount)
}

export function formatChainage(meters: number): string {
  const km = Math.floor(meters / 1000)
  const m = meters % 1000
  return `CH ${km}+${m.toString().padStart(3, '0')}`
}

export function generateLotNumber(
  areaCode: string,
  layerCode: string,
  sequence: number
): string {
  return `${areaCode}-${layerCode}-${sequence.toString().padStart(4, '0')}`
}
