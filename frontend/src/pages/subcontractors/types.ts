/**
 * Type definitions for Subcontractor-related pages and components.
 * Extracted from SubcontractorsPage.tsx for reusability.
 */

// Global subcontractor from organization directory
export interface GlobalSubcontractor {
  id: string
  companyName: string
  abn: string
  primaryContactName: string
  primaryContactEmail: string
  primaryContactPhone: string
}

export interface Employee {
  id: string
  name: string
  role: string
  hourlyRate: number
  status: 'pending' | 'approved' | 'inactive'
}

export interface Plant {
  id: string
  type: string
  description: string
  idRego: string
  dryRate: number
  wetRate: number
  status: 'pending' | 'approved' | 'inactive'
}

export interface PortalAccess {
  lots: boolean
  itps: boolean
  holdPoints: boolean
  testResults: boolean
  ncrs: boolean
  documents: boolean
}

export interface Subcontractor {
  id: string
  companyName: string
  abn: string
  primaryContact: string
  email: string
  phone: string
  status: 'pending_approval' | 'approved' | 'suspended' | 'removed'
  employees: Employee[]
  plant: Plant[]
  totalApprovedDockets: number
  totalCost: number
  portalAccess?: PortalAccess
}

// Default portal access settings
export const DEFAULT_PORTAL_ACCESS: PortalAccess = {
  lots: true,
  itps: false,
  holdPoints: false,
  testResults: false,
  ncrs: false,
  documents: false,
}

import { MapPin, ClipboardCheck, AlertTriangle, TestTube, FileWarning, FileText } from 'lucide-react'

// Portal access module definitions
export const PORTAL_MODULES = [
  { key: 'lots', label: 'Assigned Lots', icon: MapPin, description: 'View lots assigned to their company' },
  { key: 'itps', label: 'ITPs', icon: ClipboardCheck, description: 'View ITPs linked to assigned lots' },
  { key: 'holdPoints', label: 'Hold Points', icon: AlertTriangle, description: 'View hold points on assigned lots' },
  { key: 'testResults', label: 'Test Results', icon: TestTube, description: 'View test results for assigned work' },
  { key: 'ncrs', label: 'NCRs', icon: FileWarning, description: 'View NCRs related to their work' },
  { key: 'documents', label: 'Documents', icon: FileText, description: 'Access project documents' },
] as const

// Currency formatter for Australian dollars
export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(amount)

// Demo data used when API is unavailable
export const DEMO_SUBCONTRACTORS: Subcontractor[] = [
  {
    id: '1', companyName: 'ABC Earthworks Pty Ltd', abn: '12 345 678 901',
    primaryContact: 'John Smith', email: 'john@abcearthworks.com.au', phone: '0412 345 678',
    status: 'approved',
    employees: [
      { id: 'e1', name: 'John Smith', role: 'Supervisor', hourlyRate: 95, status: 'approved' },
      { id: 'e2', name: 'Mike Johnson', role: 'Operator', hourlyRate: 85, status: 'approved' },
      { id: 'e3', name: 'Dave Williams', role: 'Labourer', hourlyRate: 65, status: 'pending' }
    ],
    plant: [
      { id: 'p1', type: 'Excavator', description: '20T Excavator', idRego: 'EXC-001', dryRate: 150, wetRate: 200, status: 'approved' },
      { id: 'p2', type: 'Roller', description: 'Padfoot Roller', idRego: 'ROL-001', dryRate: 120, wetRate: 160, status: 'approved' }
    ],
    totalApprovedDockets: 18, totalCost: 77300
  },
  {
    id: '2', companyName: 'XYZ Drainage Services', abn: '98 765 432 109',
    primaryContact: 'Sarah Brown', email: 'sarah@xyzdrainage.com.au', phone: '0423 456 789',
    status: 'approved',
    employees: [
      { id: 'e4', name: 'Sarah Brown', role: 'Supervisor', hourlyRate: 90, status: 'approved' },
      { id: 'e5', name: 'Tom Wilson', role: 'Pipe Layer', hourlyRate: 80, status: 'approved' }
    ],
    plant: [
      { id: 'p3', type: 'Mini Excavator', description: '5T Mini Excavator', idRego: 'MEX-001', dryRate: 100, wetRate: 140, status: 'approved' }
    ],
    totalApprovedDockets: 15, totalCost: 66950
  },
  {
    id: '3', companyName: 'New Paving Co', abn: '11 222 333 444',
    primaryContact: 'Peter Jones', email: 'peter@newpaving.com.au', phone: '0434 567 890',
    status: 'pending_approval',
    employees: [
      { id: 'e6', name: 'Peter Jones', role: 'Foreman', hourlyRate: 100, status: 'pending' },
      { id: 'e7', name: 'Chris Lee', role: 'Operator', hourlyRate: 88, status: 'pending' }
    ],
    plant: [
      { id: 'p4', type: 'Paver', description: 'Asphalt Paver', idRego: 'PAV-001', dryRate: 250, wetRate: 0, status: 'pending' }
    ],
    totalApprovedDockets: 0, totalCost: 0
  }
]
