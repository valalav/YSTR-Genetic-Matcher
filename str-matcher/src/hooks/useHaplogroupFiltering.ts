import { useState, useCallback } from 'react';
import type { STRMatch } from '@/utils/constants';

interface HaplogroupFilterResult {
  isSubclade: boolean;
  haplogroup: string;
}

interface BatchCheckResponse {
  results: Record<string, boolean>;
}

/**
 * Hook for filtering matches by haplogroup using FTDNA tree
 * Uses batch API for efficient checking of multiple haplogroups
 */
export function useHaplogroupFiltering() {
  const [filtering, setFiltering] = useState(false);
  const [cache, setCache] = useState<Map<string, boolean>>(new Map());

  /**
   * Check if a haplogroup is a subclade of parent using FTDNA API
   */
  const checkSubclade = useCallback(async (
    haplogroup: string,
    parentHaplogroup: string
  ): Promise<boolean> => {
    // Check cache first
    const cacheKey = `${haplogroup}|${parentHaplogroup}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    try {
      const response = await fetch('/api/check-subclade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          haplogroup,
          parentHaplogroup,
        }),
      });

      if (!response.ok) {
        console.warn(`Failed to check subclade: ${haplogroup} vs ${parentHaplogroup}`);
        // Fallback: simple string matching
        return haplogroup === parentHaplogroup || haplogroup.startsWith(parentHaplogroup + '-');
      }

      const data = await response.json();
      const result = data.isSubclade || false;

      // Update cache
      setCache(prev => new Map(prev).set(cacheKey, result));

      return result;
    } catch (error) {
      console.error('Error checking subclade:', error);
      // Fallback: simple string matching
      return haplogroup === parentHaplogroup || haplogroup.startsWith(parentHaplogroup + '-');
    }
  }, [cache]);

  /**
   * Batch check multiple haplogroups against parent haplogroups
   * More efficient than individual checks
   */
  const batchCheckSubclades = useCallback(async (
    haplogroups: string[],
    parentHaplogroups: string[]
  ): Promise<Record<string, boolean>> => {
    // Check cache for all haplogroups
    const results: Record<string, boolean> = {};
    const uncachedHaplogroups: string[] = [];

    for (const haplogroup of haplogroups) {
      let found = false;
      for (const parent of parentHaplogroups) {
        const cacheKey = `${haplogroup}|${parent}`;
        if (cache.has(cacheKey)) {
          if (cache.get(cacheKey)) {
            results[haplogroup] = true;
            found = true;
            break;
          }
        }
      }
      if (!found) {
        uncachedHaplogroups.push(haplogroup);
      }
    }

    // If all cached, return immediately
    if (uncachedHaplogroups.length === 0) {
      return results;
    }

    try {
      const response = await fetch('/api/batch-check-subclades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          haplogroups: uncachedHaplogroups,
          parentHaplogroups,
        }),
      });

      if (!response.ok) {
        console.warn('Batch subclade check failed, using fallback');
        // Fallback: simple string matching
        for (const haplogroup of uncachedHaplogroups) {
          results[haplogroup] = parentHaplogroups.some(parent =>
            haplogroup === parent || haplogroup.startsWith(parent + '-')
          );
        }
        return results;
      }

      const data: BatchCheckResponse = await response.json();

      // Update cache with results
      const newCache = new Map(cache);
      for (const [haplogroup, isMatch] of Object.entries(data.results)) {
        results[haplogroup] = isMatch;
        // Cache each parent relationship
        for (const parent of parentHaplogroups) {
          newCache.set(`${haplogroup}|${parent}`, isMatch);
        }
      }
      setCache(newCache);

      return results;
    } catch (error) {
      console.error('Error in batch subclade check:', error);
      // Fallback: simple string matching
      for (const haplogroup of uncachedHaplogroups) {
        results[haplogroup] = parentHaplogroups.some(parent =>
          haplogroup === parent || haplogroup.startsWith(parent + '-')
        );
      }
      return results;
    }
  }, [cache]);

  /**
   * Filter matches by haplogroup using FTDNA tree
   */
  const filterMatchesByHaplogroup = useCallback(async (
    matches: STRMatch[],
    targetHaplogroup: string | null | undefined
  ): Promise<STRMatch[]> => {
    // No filtering if no haplogroup selected
    if (!targetHaplogroup || targetHaplogroup === '' || targetHaplogroup === 'all') {
      return matches;
    }

    setFiltering(true);

    try {
      // Extract unique haplogroups from matches
      const uniqueHaplogroups = Array.from(
        new Set(matches.map(m => m.profile?.haplogroup).filter(Boolean) as string[])
      );

      if (uniqueHaplogroups.length === 0) {
        setFiltering(false);
        return matches;
      }

      console.log(`🔍 Filtering ${matches.length} matches by haplogroup ${targetHaplogroup}`);
      console.log(`📊 Checking ${uniqueHaplogroups.length} unique haplogroups`);

      // Use batch API for efficiency
      const subcladeResults = await batchCheckSubclades(
        uniqueHaplogroups,
        [targetHaplogroup]
      );

      // Filter matches based on results
      const filteredMatches = matches.filter(match => {
        const matchHaplogroup = match.profile?.haplogroup;
        if (!matchHaplogroup) return false;
        return subcladeResults[matchHaplogroup] || false;
      });

      console.log(`✅ Filtered: ${matches.length} → ${filteredMatches.length} matches`);

      setFiltering(false);
      return filteredMatches;
    } catch (error) {
      console.error('Error filtering by haplogroup:', error);
      setFiltering(false);
      // Return all matches on error (fail-safe)
      return matches;
    }
  }, [batchCheckSubclades]);

  /**
   * Clear the cache
   */
  const clearCache = useCallback(() => {
    setCache(new Map());
  }, []);

  return {
    filterMatchesByHaplogroup,
    checkSubclade,
    batchCheckSubclades,
    filtering,
    cache,
    clearCache,
  };
}
