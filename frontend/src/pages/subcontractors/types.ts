/**
 * Type definitions for Subcontractor-related pages and components.
 * Extracted from SubcontractorsPage.tsx for reusability.
 */

// Global subcontractor from organization directory
export interface GlobalSubcontractor {
  id: string;
  companyName: string;
  abn: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  hourlyRate: number;
  status: 'pending' | 'approved' | 'inactive';
}

export interface Plant {
  id: string;
  type: string;
  description: string;
  idRego: string;
  dryRate: number;
  wetRate: number;
  status: 'pending' | 'approved' | 'inactive';
}

export interface PortalAccess {
  lots: boolean;
  itps: boolean;
  holdPoints: boolean;
  testResults: boolean;
  ncrs: boolean;
  documents: boolean;
}

export interface Subcontractor {
  id: string;
  companyName: string;
  abn: string;
  primaryContact: string;
  email: string;
  phone: string;
  status: 'pending_approval' | 'approved' | 'suspended' | 'removed';
  employees: Employee[];
  plant: Plant[];
  totalApprovedDockets: number;
  totalCost: number;
  portalAccess?: PortalAccess;
}

// Default portal access settings
export const DEFAULT_PORTAL_ACCESS: PortalAccess = {
  lots: true,
  itps: false,
  holdPoints: false,
  testResults: false,
  ncrs: false,
  documents: false,
};

import {
  MapPin,
  ClipboardCheck,
  AlertTriangle,
  TestTube,
  FileWarning,
  FileText,
} from 'lucide-react';

// Portal access module definitions
export const PORTAL_MODULES = [
  {
    key: 'lots',
    label: 'Assigned Lots',
    icon: MapPin,
    description: 'View lots assigned to their company',
  },
  {
    key: 'itps',
    label: 'ITPs',
    icon: ClipboardCheck,
    description: 'View ITPs linked to assigned lots',
  },
  {
    key: 'holdPoints',
    label: 'Hold Points',
    icon: AlertTriangle,
    description: 'View hold points on assigned lots',
  },
  {
    key: 'testResults',
    label: 'Test Results',
    icon: TestTube,
    description: 'View test results for assigned work',
  },
  { key: 'ncrs', label: 'NCRs', icon: FileWarning, description: 'View NCRs related to their work' },
  { key: 'documents', label: 'Documents', icon: FileText, description: 'Access project documents' },
] as const;

// Currency formatter for Australian dollars
export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
  }).format(amount);
