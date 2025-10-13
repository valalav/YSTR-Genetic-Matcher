/**
 * High-performance virtualized table for displaying large datasets
 * Optimized for 100k+ rows with smooth scrolling and minimal re-renders
 */

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import InfiniteLoader from 'react-window-infinite-loader';
import { STRMatch, STRProfile } from '../types';
import { useDataStore } from '../stores/dataStore';
import clsx from 'clsx';

interface VirtualizedTableProps {
  data: STRMatch[];
  height: number;
  itemHeight?: number;
  onRowClick?: (match: STRMatch) => void;
  onRemoveMatch?: (kitNumber: string) => void;
  loading?: boolean;
  hasNextPage?: boolean;
  loadMore?: () => void;
}

interface RowData {
  items: STRMatch[];
  onRowClick?: (match: STRMatch) => void;
  onRemoveMatch?: (kitNumber: string) => void;
}

const TableRow = React.memo<{
  index: number;
  style: React.CSSProperties;
  data: RowData;
}>(({ index, style, data }) => {
  const { items, onRowClick, onRemoveMatch } = data;
  const match = items[index];

  if (!match) {
    return (
      <div style={style} className="flex items-center justify-center">
        <div className="animate-pulse bg-gray-200 h-8 w-full rounded"></div>
      </div>
    );
  }

  const handleRowClick = useCallback(() => {
    onRowClick?.(match);
  }, [match, onRowClick]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveMatch?.(match.profile.kitNumber);
  }, [match.profile.kitNumber, onRemoveMatch]);

  return (
    <div
      style={style}
      className={clsx(
        "flex items-center px-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors",
        index % 2 === 0 ? "bg-white" : "bg-gray-25"
      )}
      onClick={handleRowClick}
    >
      {/* Kit Number */}
      <div className="w-24 flex-shrink-0 font-mono text-sm font-semibold text-blue-600">
        {match.profile.kitNumber}
      </div>

      {/* Name */}
      <div className="w-40 flex-shrink-0 text-sm truncate">
        {match.profile.name || '-'}
      </div>

      {/* Haplogroup */}
      <div className="w-24 flex-shrink-0 text-sm">
        <span className={clsx(
          "inline-block px-2 py-1 rounded-full text-xs font-medium",
          match.profile.haplogroup
            ? "bg-green-100 text-green-800"
            : "bg-gray-100 text-gray-500"
        )}>
          {match.profile.haplogroup || 'Unknown'}
        </span>
      </div>

      {/* Country */}
      <div className="w-32 flex-shrink-0 text-sm text-gray-600 truncate">
        {match.profile.country || '-'}
      </div>

      {/* Genetic Distance */}
      <div className="w-20 flex-shrink-0 text-center">
        <span className={clsx(
          "inline-block px-2 py-1 rounded text-xs font-bold",
          match.distance === 0
            ? "bg-green-100 text-green-800"
            : match.distance <= 5
            ? "bg-blue-100 text-blue-800"
            : match.distance <= 10
            ? "bg-yellow-100 text-yellow-800"
            : "bg-red-100 text-red-800"
        )}>
          {match.distance}
        </span>
      </div>

      {/* Compared Markers */}
      <div className="w-20 flex-shrink-0 text-center text-sm text-gray-600">
        {match.comparedMarkers}
      </div>

      {/* Percent Identical */}
      <div className="w-20 flex-shrink-0 text-center text-sm">
        <span className={clsx(
          "font-medium",
          parseFloat(match.percentIdentical) >= 95
            ? "text-green-600"
            : parseFloat(match.percentIdentical) >= 90
            ? "text-blue-600"
            : "text-gray-600"
        )}>
          {match.percentIdentical}%
        </span>
      </div>

      {/* Actions */}
      <div className="w-16 flex-shrink-0 flex justify-end">
        <button
          onClick={handleRemove}
          className="p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-700 transition-colors"
          title="Remove match"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
});

TableRow.displayName = 'TableRow';

const TableHeader: React.FC<{
  onSort: (column: string) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}> = ({ onSort, sortBy, sortOrder }) => {
  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;

    return (
      <svg
        className={clsx("w-4 h-4 ml-1 transition-transform", sortOrder === 'desc' && "rotate-180")}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
    );
  };

  const handleSort = (column: string) => {
    onSort(column);
  };

  return (
    <div className="flex items-center px-4 py-3 bg-gray-100 border-b-2 border-gray-200 font-semibold text-sm text-gray-700">
      <button
        className="w-24 flex-shrink-0 flex items-center hover:text-gray-900"
        onClick={() => handleSort('kitNumber')}
      >
        Kit Number <SortIcon column="kitNumber" />
      </button>

      <button
        className="w-40 flex-shrink-0 flex items-center hover:text-gray-900"
        onClick={() => handleSort('name')}
      >
        Name <SortIcon column="name" />
      </button>

      <button
        className="w-24 flex-shrink-0 flex items-center hover:text-gray-900"
        onClick={() => handleSort('haplogroup')}
      >
        Haplogroup <SortIcon column="haplogroup" />
      </button>

      <button
        className="w-32 flex-shrink-0 flex items-center hover:text-gray-900"
        onClick={() => handleSort('country')}
      >
        Country <SortIcon column="country" />
      </button>

      <button
        className="w-20 flex-shrink-0 flex items-center justify-center hover:text-gray-900"
        onClick={() => handleSort('distance')}
      >
        GD <SortIcon column="distance" />
      </button>

      <button
        className="w-20 flex-shrink-0 flex items-center justify-center hover:text-gray-900"
        onClick={() => handleSort('comparedMarkers')}
      >
        Markers <SortIcon column="comparedMarkers" />
      </button>

      <button
        className="w-20 flex-shrink-0 flex items-center justify-center hover:text-gray-900"
        onClick={() => handleSort('percentIdentical')}
      >
        Match % <SortIcon column="percentIdentical" />
      </button>

      <div className="w-16 flex-shrink-0 text-center">
        Actions
      </div>
    </div>
  );
};

const VirtualizedTable: React.FC<VirtualizedTableProps> = ({
  data,
  height,
  itemHeight = 60,
  onRowClick,
  onRemoveMatch,
  loading = false,
  hasNextPage = false,
  loadMore
}) => {
  const listRef = useRef<List>(null);
  const { setSorting, sortBy, sortOrder } = useDataStore();

  // Memoize row data to prevent unnecessary re-renders
  const rowData = useMemo(() => ({
    items: data,
    onRowClick,
    onRemoveMatch
  }), [data, onRowClick, onRemoveMatch]);

  // Handle sorting
  const handleSort = useCallback((column: string) => {
    const newOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    setSorting(column, newOrder);
  }, [sortBy, sortOrder, setSorting]);

  // Infinite loading support
  const isItemLoaded = useCallback((index: number) => !!data[index], [data]);

  const itemCount = hasNextPage ? data.length + 1 : data.length;

  const loadMoreItems = useCallback(async () => {
    if (loading || !hasNextPage) return;
    loadMore?.();
  }, [loading, hasNextPage, loadMore]);

  // Performance monitoring
  const renderStartTime = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    useDataStore.getState().updatePerformanceMetrics({
      lastRenderTime: renderTime
    });
  });

  // Loading state
  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading matches...</div>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <div className="text-gray-600">No matches found</div>
          <div className="text-gray-500 text-sm mt-1">Try adjusting your search criteria</div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <TableHeader onSort={handleSort} sortBy={sortBy} sortOrder={sortOrder} />

      <div style={{ height: height - 60 }}> {/* Subtract header height */}
        {hasNextPage ? (
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={itemCount}
            loadMoreItems={loadMoreItems}
          >
            {({ onItemsRendered, ref }) => (
              <List
                ref={(list) => {
                  listRef.current = list;
                  ref(list);
                }}
                height={height - 60}
                itemCount={itemCount}
                itemSize={itemHeight}
                itemData={rowData}
                onItemsRendered={onItemsRendered}
                overscanCount={5}
              >
                {TableRow}
              </List>
            )}
          </InfiniteLoader>
        ) : (
          <List
            ref={listRef}
            height={height - 60}
            itemCount={data.length}
            itemSize={itemHeight}
            itemData={rowData}
            overscanCount={5}
          >
            {TableRow}
          </List>
        )}
      </div>

      {/* Footer with stats */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-600 flex justify-between items-center">
        <div>
          Showing {data.length} matches
          {hasNextPage && (
            <span className="ml-2">
              {loading && (
                <span className="inline-flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading more...
                </span>
              )}
            </span>
          )}
        </div>

        <div className="text-xs text-gray-500">
          Last render: {useDataStore.getState().performanceMetrics.lastRenderTime.toFixed(1)}ms
        </div>
      </div>
    </div>
  );
};

export default VirtualizedTable;