export interface Lot {
  id: string
  lotNumber: string
  description: string | null
  status: string
  activityType?: string | null
  chainageStart: number | null
  chainageEnd: number | null
  offset: string | null
  layer: string | null
  areaZone: string | null
  budgetAmount?: number | null
  assignedSubcontractorId?: string | null
  assignedSubcontractor?: { companyName: string } | null
  // Additional properties for expanded view
  createdAt?: string | null
  updatedAt?: string | null
  itpCount?: number
  testCount?: number
  documentCount?: number
  ncrCount?: number
  holdPointCount?: number
  notes?: string | null
}
