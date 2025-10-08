/**
 * Zustand store for managing large datasets efficiently
 * Optimized for 100-200k profiles with virtualization and caching
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { STRProfile, STRMatch, SearchFilters, BatchProcessingStatus } from '../types';

interface DataState {
  // Dataset management
  profiles: STRProfile[];
  totalProfiles: number;
  loadedChunks: Set<number>;
  chunkSize: number;

  // Search and matching
  query: STRProfile | null;
  matches: STRMatch[];
  isSearching: boolean;
  searchError: string | null;
  lastSearchTime: number;

  // Pagination and virtualization
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;

  // Filtering and sorting
  filters: SearchFilters;
  sortBy: string;
  sortOrder: 'asc' | 'desc';

  // Batch processing
  batchStatus: BatchProcessingStatus | null;
  uploadProgress: number;

  // Performance metrics
  performanceMetrics: {
    lastQueryTime: number;
    lastRenderTime: number;
    memoryUsage: number;
    cacheHitRate: number;
  };

  // Cache management
  cache: Map<string, any>;
  cacheSize: number;
  maxCacheSize: number;
}

interface DataActions {
  // Profile management
  setProfiles: (profiles: STRProfile[]) => void;
  addProfiles: (profiles: STRProfile[]) => void;
  loadProfileChunk: (chunkIndex: number) => Promise<void>;
  removeProfile: (kitNumber: string) => void;
  clearProfiles: () => void;

  // Search operations
  setQuery: (query: STRProfile | null) => void;
  searchMatches: (options?: SearchOptions) => Promise<void>;
  clearMatches: () => void;
  setFilters: (filters: Partial<SearchFilters>) => void;

  // Pagination
  setPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;

  // Sorting
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;

  // Batch operations
  startBatchUpload: (file: File) => Promise<void>;
  updateBatchStatus: (status: BatchProcessingStatus) => void;

  // Cache management
  getCachedData: <T>(key: string) => T | undefined;
  setCachedData: <T>(key: string, data: T, ttl?: number) => void;
  clearCache: () => void;

  // Performance
  updatePerformanceMetrics: (metrics: Partial<DataState['performanceMetrics']>) => void;
  optimizeMemoryUsage: () => void;
}

interface SearchOptions {
  maxDistance?: number;
  maxResults?: number;
  markerCount?: number;
  useCache?: boolean;
  haplogroupFilter?: string;
  includeSubclades?: boolean;
}

const CHUNK_SIZE = 5000; // Profiles per chunk
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB cache limit
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export const useDataStore = create<DataState & DataActions>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        // Initial state
        profiles: [],
        totalProfiles: 0,
        loadedChunks: new Set(),
        chunkSize: CHUNK_SIZE,

        query: null,
        matches: [],
        isSearching: false,
        searchError: null,
        lastSearchTime: 0,

        currentPage: 0,
        pageSize: 100,
        hasNextPage: true,

        filters: {
          maxDistance: 25,
          maxResults: 1000,
          markerCount: 37,
          haplogroupFilter: '',
          includeSubclades: false
        },
        sortBy: 'distance',
        sortOrder: 'asc',

        batchStatus: null,
        uploadProgress: 0,

        performanceMetrics: {
          lastQueryTime: 0,
          lastRenderTime: 0,
          memoryUsage: 0,
          cacheHitRate: 0
        },

        cache: new Map(),
        cacheSize: 0,
        maxCacheSize: MAX_CACHE_SIZE,

        // Actions
        setProfiles: (profiles) => set((state) => {
          state.profiles = profiles;
          state.totalProfiles = profiles.length;
          state.loadedChunks.clear();
          state.loadedChunks.add(0);
        }),

        addProfiles: (newProfiles) => set((state) => {
          // Merge with existing profiles, avoiding duplicates
          const existingKitNumbers = new Set(state.profiles.map(p => p.kitNumber));
          const uniqueNewProfiles = newProfiles.filter(p => !existingKitNumbers.has(p.kitNumber));

          state.profiles.push(...uniqueNewProfiles);
          state.totalProfiles = state.profiles.length;
        }),

        loadProfileChunk: async (chunkIndex) => {
          const state = get();
          if (state.loadedChunks.has(chunkIndex)) return;

          try {
            // This would make API call to load specific chunk
            const response = await fetch(`/api/profiles?offset=${chunkIndex * CHUNK_SIZE}&limit=${CHUNK_SIZE}`);
            const data = await response.json();

            set((state) => {
              const startIndex = chunkIndex * CHUNK_SIZE;
              data.profiles.forEach((profile: STRProfile, index: number) => {
                state.profiles[startIndex + index] = profile;
              });
              state.loadedChunks.add(chunkIndex);
            });
          } catch (error) {
            console.error('Failed to load chunk:', error);
          }
        },

        removeProfile: (kitNumber) => set((state) => {
          state.profiles = state.profiles.filter(p => p.kitNumber !== kitNumber);
          state.matches = state.matches.filter(m => m.profile.kitNumber !== kitNumber);
          state.totalProfiles = state.profiles.length;
        }),

        clearProfiles: () => set((state) => {
          state.profiles = [];
          state.totalProfiles = 0;
          state.loadedChunks.clear();
          state.matches = [];
        }),

        setQuery: (query) => set((state) => {
          state.query = query;
        }),

        searchMatches: async (options = {}) => {
          const state = get();
          if (!state.query) return;

          const searchOptions = { ...state.filters, ...options };
          const cacheKey = `search:${JSON.stringify({ query: state.query.markers, ...searchOptions })}`;

          set((state) => {
            state.isSearching = true;
            state.searchError = null;
          });

          const startTime = Date.now();

          try {
            // Check cache first
            const cachedResult = state.getCachedData<STRMatch[]>(cacheKey);
            if (cachedResult && searchOptions.useCache !== false) {
              set((state) => {
                state.matches = cachedResult;
                state.isSearching = false;
                state.lastSearchTime = Date.now() - startTime;
                state.performanceMetrics.cacheHitRate += 0.1;
              });
              return;
            }

            // Make API request
            const response = await fetch('/api/profiles/find-matches', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                markers: state.query.markers,
                ...searchOptions
              })
            });

            if (!response.ok) {
              throw new Error(`Search failed: ${response.statusText}`);
            }

            const data = await response.json();

            set((state) => {
              state.matches = data.matches;
              state.isSearching = false;
              state.lastSearchTime = Date.now() - startTime;
              state.setCachedData(cacheKey, data.matches, CACHE_TTL);
            });

            // Update performance metrics
            get().updatePerformanceMetrics({
              lastQueryTime: Date.now() - startTime
            });

          } catch (error) {
            set((state) => {
              state.isSearching = false;
              state.searchError = error instanceof Error ? error.message : 'Search failed';
            });
          }
        },

        clearMatches: () => set((state) => {
          state.matches = [];
          state.searchError = null;
        }),

        setFilters: (newFilters) => set((state) => {
          state.filters = { ...state.filters, ...newFilters };
        }),

        setPage: (page) => set((state) => {
          state.currentPage = page;
        }),

        nextPage: () => set((state) => {
          if (state.hasNextPage) {
            state.currentPage += 1;
          }
        }),

        previousPage: () => set((state) => {
          if (state.currentPage > 0) {
            state.currentPage -= 1;
          }
        }),

        setSorting: (sortBy, sortOrder) => set((state) => {
          state.sortBy = sortBy;
          state.sortOrder = sortOrder;

          // Sort matches if they exist
          if (state.matches.length > 0) {
            state.matches.sort((a, b) => {
              const aVal = sortBy === 'distance' ? a.distance : a.profile[sortBy as keyof STRProfile];
              const bVal = sortBy === 'distance' ? b.distance : b.profile[sortBy as keyof STRProfile];

              if (sortOrder === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
              } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
              }
            });
          }
        }),

        startBatchUpload: async (file) => {
          set((state) => {
            state.uploadProgress = 0;
            state.batchStatus = {
              id: `batch_${Date.now()}`,
              status: 'uploading',
              progress: 0,
              totalProfiles: 0,
              processedProfiles: 0
            };
          });

          try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/profiles/upload', {
              method: 'POST',
              body: formData
            });

            if (!response.ok) {
              throw new Error(`Upload failed: ${response.statusText}`);
            }

            const result = await response.json();

            set((state) => {
              state.batchStatus = {
                id: result.batchId,
                status: 'processing',
                progress: 0,
                totalProfiles: result.totalProcessed,
                processedProfiles: 0
              };
            });

            // Poll for batch status updates
            get().pollBatchStatus(result.batchId);

          } catch (error) {
            set((state) => {
              state.batchStatus = {
                id: 'error',
                status: 'failed',
                progress: 0,
                totalProfiles: 0,
                processedProfiles: 0,
                error: error instanceof Error ? error.message : 'Upload failed'
              };
            });
          }
        },

        pollBatchStatus: async (batchId: string) => {
          const pollInterval = setInterval(async () => {
            try {
              const response = await fetch(`/api/admin/batch-status/${batchId}`);
              const status = await response.json();

              set((state) => {
                if (state.batchStatus) {
                  state.batchStatus.status = status.status;
                  state.batchStatus.progress = status.progress;
                }
              });

              if (status.status === 'completed' || status.status === 'failed') {
                clearInterval(pollInterval);

                if (status.status === 'completed') {
                  // Refresh profile list
                  window.location.reload(); // Simple approach, could be optimized
                }
              }
            } catch (error) {
              console.error('Failed to poll batch status:', error);
              clearInterval(pollInterval);
            }
          }, 2000);
        },

        updateBatchStatus: (status) => set((state) => {
          state.batchStatus = status;
        }),

        getCachedData: <T>(key: string): T | undefined => {
          const cached = get().cache.get(key);
          if (!cached) return undefined;

          if (Date.now() > cached.expiry) {
            get().cache.delete(key);
            return undefined;
          }

          return cached.data as T;
        },

        setCachedData: <T>(key: string, data: T, ttl = CACHE_TTL) => set((state) => {
          const cached = {
            data,
            expiry: Date.now() + ttl,
            size: JSON.stringify(data).length
          };

          state.cache.set(key, cached);
          state.cacheSize += cached.size;

          // Clean up cache if it exceeds limit
          if (state.cacheSize > state.maxCacheSize) {
            get().optimizeMemoryUsage();
          }
        }),

        clearCache: () => set((state) => {
          state.cache.clear();
          state.cacheSize = 0;
        }),

        updatePerformanceMetrics: (metrics) => set((state) => {
          state.performanceMetrics = { ...state.performanceMetrics, ...metrics };
        }),

        optimizeMemoryUsage: () => set((state) => {
          // Remove expired cache entries
          const now = Date.now();
          for (const [key, cached] of state.cache.entries()) {
            if (now > cached.expiry) {
              state.cache.delete(key);
              state.cacheSize -= cached.size;
            }
          }

          // If still over limit, remove oldest entries
          if (state.cacheSize > state.maxCacheSize) {
            const entries = Array.from(state.cache.entries());
            entries.sort((a, b) => a[1].expiry - b[1].expiry);

            while (state.cacheSize > state.maxCacheSize * 0.8 && entries.length > 0) {
              const [key, cached] = entries.shift()!;
              state.cache.delete(key);
              state.cacheSize -= cached.size;
            }
          }

          // Update memory usage metric
          state.performanceMetrics.memoryUsage = state.cacheSize;
        })
      })),
      {
        name: 'ystr-data-store',
        partialize: (state) => ({
          filters: state.filters,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          performanceMetrics: state.performanceMetrics
        })
      }
    )
  )
);

// Selectors for optimized re-renders
export const useProfiles = () => useDataStore(state => state.profiles);
export const useMatches = () => useDataStore(state => state.matches);
export const useQuery = () => useDataStore(state => state.query);
export const useIsSearching = () => useDataStore(state => state.isSearching);
export const useFilters = () => useDataStore(state => state.filters);
export const useBatchStatus = () => useDataStore(state => state.batchStatus);
export const usePerformanceMetrics = () => useDataStore(state => state.performanceMetrics);