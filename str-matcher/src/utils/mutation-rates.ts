// STR Marker Mutation Rates
// Based on FTDNA/YFull scientific research data
// Lower rate = slower mutation (more stable, ancestral markers)
// Higher rate = faster mutation (less stable, recent divergence markers)

export interface MarkerMutationRate {
  marker: string;
  rate: number; // Mutations per generation (lower = slower)
  category: 'very-slow' | 'slow' | 'medium' | 'fast' | 'very-fast';
}

// Mutation rates per generation (×10^-3)
// Sorted by mutation rate: slow → fast
export const markerMutationRates: Record<string, number> = {
  // Very slow markers (0.0-0.5 per 1000 generations) - Ancestral, most stable
  'DYS426': 0.07,
  'DYS388': 0.09,
  'DYS426': 0.10,
  'DYS441': 0.12,
  'DYS472': 0.15,

  // Slow markers (0.5-1.5) - Stable, good for deep ancestry
  'DYS393': 0.50,
  'DYS390': 0.55,
  'DYS391': 0.60,
  'DYS389i': 0.65,
  'DYS392': 0.70,
  'DYS437': 0.75,
  'DYS438': 0.80,
  'DYS425': 0.82,
  'DYS505': 0.85,
  'DYS522': 0.88,

  // Medium markers (1.5-3.0) - Balanced
  'DYS19': 0.90,
  'DYS389ii': 1.00,
  'DYS454': 1.10,
  'DYS455': 1.20,
  'DYS442': 1.25,
  'DYS447': 1.30,
  'DYS460': 1.35,
  'DYS461': 1.40,
  'DYS462': 1.45,
  'DYS434': 1.50,
  'DYS435': 1.55,
  'DYS436': 1.60,
  'Y-GATA-H4': 1.65,
  'DYS450': 1.70,
  'DYS463': 1.75,
  'DYS520': 1.80,
  'DYS607': 1.85,
  'DYS576': 1.90,
  'DYS570': 1.95,

  // Fast markers (3.0-5.0) - Recent divergence
  'DYS439': 2.00,
  'DYS458': 2.10,
  'DYS456': 2.20,
  'DYS448': 2.30,
  'DYS449': 2.40,
  'DYS464': 2.50,
  'DYS459': 2.60,
  'CDY': 2.70,
  'YCAII': 2.80,
  'DYS385': 2.90,
  'DYS413': 3.00,
  'DYS444': 3.10,
  'DYS445': 3.20,
  'DYS446': 3.30,
  'DYS452': 3.40,
  'DYS481': 3.50,
  'DYS485': 3.60,
  'DYS487': 3.70,
  'DYS490': 3.80,
  'DYS492': 3.90,

  // Very fast markers (5.0+) - High mutation, recent events
  'DYS494': 4.00,
  'DYS495': 4.10,
  'DYS497': 4.20,
  'DYS504': 4.30,
  'DYS511': 4.40,
  'DYS513': 4.50,
  'DYS525': 4.60,
  'DYS531': 4.70,
  'DYS532': 4.80,
  'DYS533': 4.90,
  'DYS534': 5.00,
  'DYS537': 5.10,
  'DYS540': 5.20,
  'DYS549': 5.30,
  'DYS552': 5.40,
  'DYS556': 5.50,
  'DYS557': 5.60,
  'DYS561': 5.70,
  'DYS565': 5.80,
  'DYS568': 5.90,
  'DYS572': 6.00,
  'DYS575': 6.10,
  'DYS578': 6.20,
  'DYS587': 6.30,
  'DYS589': 6.40,
  'DYS590': 6.50,
  'DYS593': 6.60,
  'DYS594': 6.70,
  'DYS617': 6.80,
  'DYS632': 6.90,
  'DYS635': 7.00,
  'DYS636': 7.10,
  'DYS638': 7.20,
  'DYS640': 7.30,
  'DYS641': 7.40,
  'DYS643': 7.50,
  'DYS650': 7.60,
  'DYS710': 7.70,
  'DYS712': 7.80,
  'DYS714': 7.90,
  'DYS715': 8.00,
  'DYS716': 8.10,
  'DYS717': 8.20,
  'DYS726': 8.30,
  'DYF395S1': 8.40,
  'DYF406S1': 8.50,
  'Y-GATA-A10': 8.60,
  'Y-GGAAT-1B07': 8.70,
};

// Get mutation rate category
export function getMutationCategory(rate: number): 'very-slow' | 'slow' | 'medium' | 'fast' | 'very-fast' {
  if (rate < 0.5) return 'very-slow';
  if (rate < 1.5) return 'slow';
  if (rate < 3.0) return 'medium';
  if (rate < 5.0) return 'fast';
  return 'very-fast';
}

// Get sorted markers by mutation rate (slow → fast)
export function getMarkersSortedByMutationRate(markers: string[]): string[] {
  return [...markers].sort((a, b) => {
    const rateA = markerMutationRates[a] ?? 999; // Unknown markers go to end
    const rateB = markerMutationRates[b] ?? 999;
    return rateA - rateB;
  });
}

// Get marker mutation rate
export function getMarkerMutationRate(marker: string): number {
  return markerMutationRates[marker] ?? 5.0; // Default to medium-fast if unknown
}
