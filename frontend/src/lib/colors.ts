/**
 * Feature #438: Okabe-Ito Color-Blind Safe Palette
 *
 * This palette is designed to be accessible to people with various forms of color blindness.
 * Reference: https://jfly.uni-koeln.de/color/
 *
 * The colors are distinguishable for:
 * - Deuteranopia (red-green color blindness)
 * - Protanopia (red-green color blindness)
 * - Tritanopia (blue-yellow color blindness)
 */

// Okabe-Ito Color Palette (hex values)
export const OKABE_ITO = {
  black: '#000000',
  orange: '#E69F00',      // Amber/warning - replaces yellow
  skyBlue: '#56B4E9',     // In progress
  bluishGreen: '#009E73', // Success/completed
  yellow: '#F0E442',      // For highlights only (not as bg)
  blue: '#0072B2',        // Info/primary
  vermilion: '#D55E00',   // Error/danger - more distinguishable than red
  reddishPurple: '#CC79A7', // On hold/blocked
} as const;

// Tailwind-compatible class mappings for the Okabe-Ito palette
export const ACCESSIBLE_STATUS_COLORS: Record<string, string> = {
  // Pending: Orange (warm, attention-getting)
  pending: 'bg-[#E69F00]/20 text-[#B47F00] border-[#E69F00]/30',

  // In Progress: Sky Blue
  in_progress: 'bg-[#56B4E9]/20 text-[#0072B2] border-[#56B4E9]/30',

  // Completed: Bluish Green
  completed: 'bg-[#009E73]/20 text-[#007056] border-[#009E73]/30',

  // On Hold: Vermilion (distinct from green for red-green colorblind)
  on_hold: 'bg-[#D55E00]/20 text-[#A34700] border-[#D55E00]/30',

  // Not Started: Neutral gray
  not_started: 'bg-gray-100 text-gray-700 border-gray-200',

  // Failed/Error: Reddish Purple (distinct from both red and green)
  failed: 'bg-[#CC79A7]/20 text-[#9A5A80] border-[#CC79A7]/30',
  error: 'bg-[#CC79A7]/20 text-[#9A5A80] border-[#CC79A7]/30',

  // Draft: Blue
  draft: 'bg-[#0072B2]/20 text-[#005689] border-[#0072B2]/30',

  // Approved: Bluish Green (same as completed)
  approved: 'bg-[#009E73]/20 text-[#007056] border-[#009E73]/30',

  // Rejected: Vermilion
  rejected: 'bg-[#D55E00]/20 text-[#A34700] border-[#D55E00]/30',

  // Pending Approval: Orange
  pending_approval: 'bg-[#E69F00]/20 text-[#B47F00] border-[#E69F00]/30',
};

// Simpler version for use where custom colors might not work
export const ACCESSIBLE_STATUS_COLORS_TAILWIND: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  in_progress: 'bg-sky-100 text-sky-800 border-sky-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  on_hold: 'bg-orange-100 text-orange-800 border-orange-200',
  not_started: 'bg-gray-100 text-gray-700 border-gray-200',
  failed: 'bg-pink-100 text-pink-800 border-pink-200',
  error: 'bg-pink-100 text-pink-800 border-pink-200',
  draft: 'bg-blue-100 text-blue-800 border-blue-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-orange-100 text-orange-800 border-orange-200',
  pending_approval: 'bg-amber-100 text-amber-800 border-amber-200',
};

// Chart colors for graphs and visualizations
export const CHART_COLORS = {
  primary: OKABE_ITO.blue,
  secondary: OKABE_ITO.skyBlue,
  success: OKABE_ITO.bluishGreen,
  warning: OKABE_ITO.orange,
  danger: OKABE_ITO.vermilion,
  info: OKABE_ITO.reddishPurple,
  neutral: OKABE_ITO.black,
};

// Array of colors for multi-series charts (ordered for maximum distinction)
export const CHART_COLOR_SEQUENCE = [
  OKABE_ITO.blue,
  OKABE_ITO.orange,
  OKABE_ITO.bluishGreen,
  OKABE_ITO.vermilion,
  OKABE_ITO.skyBlue,
  OKABE_ITO.reddishPurple,
  OKABE_ITO.yellow,
];

/**
 * Get accessible status color classes
 * @param status - The status string
 * @param useTailwind - Use Tailwind-compatible colors instead of custom hex
 * @returns CSS class string
 */
export function getStatusColorClasses(status: string, useTailwind = false): string {
  const palette = useTailwind ? ACCESSIBLE_STATUS_COLORS_TAILWIND : ACCESSIBLE_STATUS_COLORS;
  return palette[status] || palette[status.toLowerCase()] || 'bg-gray-100 text-gray-700';
}

/**
 * Get a distinct color from the Okabe-Ito palette for data visualization
 * @param index - The index of the data series
 * @returns Hex color string
 */
export function getChartColor(index: number): string {
  return CHART_COLOR_SEQUENCE[index % CHART_COLOR_SEQUENCE.length];
}
