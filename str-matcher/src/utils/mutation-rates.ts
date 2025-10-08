// STR Marker Mutation Rates
// Based on FTDNA scientific research data
// Lower speed place = slower mutation (more stable, ancestral markers)
// Higher speed place = faster mutation (less stable, recent divergence markers)

export interface MarkerMutationRate {
  marker: string;
  speedPlace: number; // 1 = slowest, 111 = fastest
}

// Mutation speed ranking from FTDNA data
// Place 1 = slowest (most stable) → Place 111 = fastest (most variable)
export const markerMutationRates: Record<string, number> = {
  // Very slow markers (places 1-20) - Ancestral, most stable
  'DYS472': 1,
  'DYS436': 2,
  'DYS425': 3,
  'DYS568': 4,
  'DYS490': 5,
  'DYS426': 6,
  'DYS455': 7,
  'DYS632': 8,
  'DYS494': 9,
  'DYS450': 10,
  'DYS435': 11,
  'DYS593': 12,
  'DYS640': 13,
  'DYS492': 14,
  'DYS641': 15,
  'DYS594': 16,
  'DYS726': 17,
  'DYS388': 18,
  'DYS636': 19,
  'DYS638': 20,

  // Slow markers (places 21-40)
  'DYS454': 21,
  'DYS575': 22,
  'DYS462': 23,
  'DYS434': 24,
  'DYS590': 25,
  'DYS438': 26,
  'DYS392': 27,
  'DYS459': 28, // Combined a/b
  'DYF395S1': 29, // Combined a/b
  'DYS578': 31,
  'DYS617': 32,
  'DYS716': 33,
  'DYS445': 34,
  'DYS393': 35,
  'DYS717': 36,
  'DYS437': 37,
  'DYS589': 38,
  'DYS487': 39,
  'DYS389i': 40,

  // Medium markers (places 41-70)
  'DYS556': 41,
  'DYS531': 42,
  'DYS537': 43,
  'DYF406S1': 44,
  'DYS511': 45,
  'DYS572': 46,
  'DYS464': 48, // Combined a/b/c/d (average ~48)
  'DYS452': 49,
  'Y-GGAAT-1B07': 50,
  'DYS497': 52,
  'DYS587': 53,
  'DYS533': 54,
  'DYS540': 55,
  'DYS561': 56,
  'DYS448': 57,
  'DYS495': 59,
  'DYS461': 60,
  'DYS520': 61,
  'DYS513': 62,
  'DYS485': 63,
  'DYS522': 64,
  'Y-GATA-H4': 65,
  'DYS525': 66,
  'DYS19': 67,
  'DYS444': 68,
  'DYS565': 69,
  'DYS460': 70,

  // Fast markers (places 71-90)
  'DYS413': 71, // Combined a/b
  'DYS549': 73,
  'YCAII': 77, // Combined a/b (average of 74 and 80)
  'DYS441': 75,
  'DYS390': 76,
  'DYS391': 77,
  'DYS635': 78,
  'DYS389ii': 79,
  'DYS463': 82,
  'DYS643': 83,
  'DYS607': 84,
  'DYS557': 85,
  'DYS385': 86, // Combined a/b (average of 86 and 97)
  'DYS446': 87,
  'DYS439': 88,
  'DYS505': 89,
  'DYS504': 90,

  // Very fast markers (places 91-111) - High mutation, recent events
  'DYS510': 91,
  'DYS534': 92,
  'DYS447': 93,
  'Y-GATA-A10': 94,
  'DYS715': 95,
  'DYS532': 96,
  'DYS552': 98,
  'DYS650': 99,
  'DYS481': 100,
  'DYS442': 101,
  'DYS456': 102,
  'DYS714': 103,
  'DYS570': 104,
  'DYS576': 105,
  'DYS458': 106,
  'DYS712': 107,
  'CDY': 109, // Combined a/b (average of 108 and 110)
  'DYS449': 109,
  'DYS710': 111,
};

// Get sorted markers by mutation rate (slow → fast)
export function getMarkersSortedByMutationRate(markers: string[]): string[] {
  return [...markers].sort((a, b) => {
    const rateA = markerMutationRates[a] ?? 999; // Unknown markers go to end
    const rateB = markerMutationRates[b] ?? 999;
    return rateA - rateB; // Lower place = slower = leftmost
  });
}

// Get marker mutation speed place
export function getMarkerMutationPlace(marker: string): number {
  return markerMutationRates[marker] ?? 999; // Default to end if unknown
}

// Get mutation category based on place
export function getMutationCategory(place: number): 'very-slow' | 'slow' | 'medium' | 'fast' | 'very-fast' {
  if (place <= 20) return 'very-slow';
  if (place <= 40) return 'slow';
  if (place <= 70) return 'medium';
  if (place <= 90) return 'fast';
  return 'very-fast';
}
