// Main types for YSTR Matcher v2

export interface STRProfile {
  kitNumber: string;
  name?: string;
  country?: string;
  haplogroup?: string;
  markers: Record<string, string>;
  createdAt?: string;
}

export interface STRMatch {
  profile: STRProfile;
  distance: number;
  comparedMarkers: number;
  identicalMarkers: number;
  percentIdentical: string;
}

export interface SearchFilters {
  maxDistance: number;
  maxResults: number;
  markerCount: number;
  haplogroupFilter: string;
  includeSubclades: boolean;
}

export interface BatchProcessingStatus {
  id: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalProfiles: number;
  processedProfiles: number;
  error?: string;
}

export interface HaplogroupPrediction {
  haplogroup: string;
  confidence: number;
  alternatives: Array<{
    haplogroup: string;
    confidence: number;
  }>;
  method: string;
  processingTime: number;
}