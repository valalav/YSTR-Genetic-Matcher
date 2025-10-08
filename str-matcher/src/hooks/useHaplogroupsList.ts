import { useState, useEffect } from 'react';
import { API_URL } from '@/config/axios';

export interface HaplogroupInfo {
  haplogroup: string;
  total_profiles: number;
  avg_markers: string;
  description: string;
  loaded_at: string;
  status: string;
}

export const useHaplogroupsList = (minProfiles: number = 100) => {
  const [haplogroups, setHaplogroups] = useState<HaplogroupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHaplogroups = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/databases/haplogroups?minProfiles=${minProfiles}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error('Failed to fetch haplogroups');
        }

        setHaplogroups(data.haplogroups);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        setHaplogroups([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHaplogroups();
  }, [minProfiles]);

  return { haplogroups, loading, error };
};
