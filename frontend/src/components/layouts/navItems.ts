/**
 * Shared navigation config for the desktop Sidebar and the MobileNav drawer.
 *
 * Only the pieces that are genuinely identical across both surfaces live here:
 * the project (in-project) nav list plus the role/menu filter constants that
 * both files apply to it. Surface-specific lists stay in their own components
 * and deliberately differ:
 *   - the global `navigation` list (Sidebar has Portfolio, MobileNav does not)
 *   - `subcontractorNavigation` (the known subbie-nav mismatch — parked)
 *   - Sidebar's `settingsNavigation`; MobileNav's bottom-bar lists
 *
 * Keeping the shared project list in one place means adding/renaming an
 * in-project menu item updates both surfaces at once.
 */
import {
  LayoutDashboard,
  MapPin,
  ClipboardCheck,
  AlertTriangle,
  TestTube,
  FileWarning,
  Calendar,
  DollarSign,
  FileText,
  Users,
  BarChart3,
  Settings,
  FileCheck,
  GitPullRequest,
} from 'lucide-react';

// Office roles (owner/admin/PM/QM = ROLE_GROUPS.QUALITY) get a grouped project
// menu with these section labels, in this order. Field roles keep the flat list.
export const OFFICE_SECTION_ORDER = ['Quality', 'Commercial', 'Records', 'Admin'] as const;
export type NavSection = (typeof OFFICE_SECTION_ORDER)[number];

export interface NavigationItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  // MobileNav bottom-bar links use `end` for exact-match active state.
  end?: boolean;
  requiresProject?: boolean;
  requiresCommercialAccess?: boolean;
  requiresAdmin?: boolean;
  // Sidebar-only settings gate; harmless superset field for MobileNav.
  requiresAuditLogAccess?: boolean;
  requiresManagement?: boolean;
  requiresProjectSettingsAccess?: boolean;
  allowedRoles?: readonly string[];
  excludeRoles?: readonly string[];
  section?: NavSection;
}

// Foreman simplified menu - only sees essential field items.
export const FOREMAN_MENU_ITEMS = [
  'Lots',
  'ITPs',
  'Hold Points',
  'Test Results',
  'NCRs',
  'Daily Diary',
  'Docket Approvals',
];

export const VIEWER_PROJECT_MENU_ITEMS = ['Lots', 'Reports'];

// In-project navigation, shared by both surfaces.
export const projectNavigation: NavigationItem[] = [
  { name: 'Lots', href: 'lots', icon: MapPin, section: 'Quality' },
  { name: 'ITPs', href: 'itp', icon: ClipboardCheck, section: 'Quality' },
  { name: 'Hold Points', href: 'hold-points', icon: AlertTriangle, section: 'Quality' },
  { name: 'Test Results', href: 'tests', icon: TestTube, section: 'Quality' },
  { name: 'NCRs', href: 'ncr', icon: FileWarning, section: 'Quality' },
  { name: 'Daily Diary', href: 'diary', icon: Calendar },
  {
    name: 'Progress Claims',
    href: 'claims',
    icon: DollarSign,
    requiresCommercialAccess: true,
    section: 'Commercial',
  },
  {
    name: 'Variations',
    href: 'variations',
    icon: GitPullRequest,
    requiresCommercialAccess: true,
    section: 'Commercial',
  },
  {
    name: 'Costs',
    href: 'costs',
    icon: DollarSign,
    requiresCommercialAccess: true,
    section: 'Commercial',
  },
  { name: 'Docket Approvals', href: 'dockets', icon: FileCheck, section: 'Commercial' },
  { name: 'Documents', href: 'documents', icon: FileText, section: 'Records' },
  {
    name: 'Subcontractors',
    href: 'subcontractors',
    icon: Users,
    requiresManagement: true,
    section: 'Records',
  },
  { name: 'Reports', href: 'reports', icon: BarChart3, section: 'Records' },
  {
    name: 'Project Settings',
    href: 'settings',
    icon: Settings,
    requiresProjectSettingsAccess: true,
    section: 'Admin',
  },
];
