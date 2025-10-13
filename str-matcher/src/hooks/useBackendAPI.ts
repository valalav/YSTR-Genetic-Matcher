import { useState, useCallback } from 'react';
import { API_URL } from '@/config/axios';
import type { STRProfile, STRMatch } from '@/utils/constants';

interface BackendSearchParams {
  markers: Record<string, string>;
  maxDistance?: number;
  limit?: number;
  markerCount?: 12 | 25 | 37 | 67 | 111;
  haplogroupFilter?: string;
}

interface BackendResponse {
  success: boolean;
  matches: Array<{
    profile: {
      kitNumber: string;
      name: string;
      country: string;
      haplogroup: string;
      markers: Record<string, string>;
    };
    distance: number;
    comparedMarkers: number;
    identicalMarkers: number;
    percentIdentical: string;
  }>;
  total: number;
  options: {
    maxDistance: number;
    maxResults: number;
    markerCount: number;
  };
}

interface DatabaseStats {
  success: boolean;
  statistics: {
    totalProfiles: number;
    uniqueHaplogroups: number;
    avgMarkersPerProfile: string;
    topHaplogroups: Array<{
      haplogroup: string;
      count: string;
    }>;
    lastUpdated: string;
  };
}

export const useBackendAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findMatches = useCallback(async (params: BackendSearchParams): Promise<STRMatch[]> => {
    setLoading(true);
    setError(null);

    try {
      console.log("🔍 Frontend sending params:", params);

      // Transform params to match API expectations
      const apiParams = {
        markers: params.markers,
        maxDistance: params.maxDistance ?? 25,
        maxResults: params.limit ?? 1000,
        markerCount: params.markerCount ?? 37,
        haplogroupFilter: params.haplogroupFilter || undefined
      };

      // Remove undefined values to avoid validation issues
      Object.keys(apiParams).forEach(key => {
        if (apiParams[key as keyof typeof apiParams] === undefined) {
          delete apiParams[key as keyof typeof apiParams];
        }
      });

      console.log("🔍 Frontend sending apiParams:", JSON.stringify(apiParams, null, 2));

      const response = await fetch(`${API_URL}/profiles/find-matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiParams),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error || errorData?.details?.[0]?.message || `HTTP error! status: ${response.status}`;
        console.error('API Error:', errorData);
        throw new Error(errorMessage);
      }

      const data: BackendResponse = await response.json();

      if (!data.success) {
        throw new Error('Search failed');
      }

      // Convert backend format to frontend format
      const matches: STRMatch[] = data.matches.map(match => ({
        profile: {
          kitNumber: match.profile.kitNumber,
          name: match.profile.name || '',
          country: match.profile.country || '',
          haplogroup: match.profile.haplogroup || '',
          markers: match.profile.markers,
        },
        distance: match.distance,
        comparedMarkers: match.comparedMarkers,
        identicalMarkers: match.identicalMarkers,
        percentIdentical: parseFloat(match.percentIdentical),
        hasAllRequiredMarkers: true, // Backend filters ensure required markers exist
      }));

      return matches;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getProfile = useCallback(async (kitNumber: string): Promise<STRProfile | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/profiles/${kitNumber}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch profile');
      }

      const profile: STRProfile = {
        kitNumber: data.profile.kitNumber,
        name: data.profile.name || '',
        country: data.profile.country || '',
        haplogroup: data.profile.haplogroup || '',
        markers: data.profile.markers,
      };

      return profile;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getDatabaseStats = useCallback(async (): Promise<DatabaseStats | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/profiles/stats/database`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: DatabaseStats = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch database stats');
      }

      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchProfiles = useCallback(async (params: {
    haplogroup?: string;
    country?: string;
    limit?: number;
  }): Promise<STRProfile[]> => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (params.haplogroup) queryParams.append('haplogroup', params.haplogroup);
      if (params.country) queryParams.append('country', params.country);
      if (params.limit) queryParams.append('limit', params.limit.toString());

      const response = await fetch(`${API_URL}/profiles?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to search profiles');
      }

      return data.profiles.map((profile: any): STRProfile => ({
        kitNumber: profile.kitNumber,
        name: profile.name || '',
        country: profile.country || '',
        haplogroup: profile.haplogroup || '',
        markers: profile.markers,
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    findMatches,
    getProfile,
    getDatabaseStats,
    searchProfiles,
    loading,
    error,
  };
};