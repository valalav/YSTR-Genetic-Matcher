"use client";

import React, { useState, useMemo, useCallback } from 'react';
import type { STRMatch, STRProfile } from '@/utils/constants';
import { calculateMarkerDifference } from '@/utils/calculations';
import { palindromes } from '@/utils/constants';

interface AdvancedMatchesTableProps {
  matches: STRMatch[];
  query: STRProfile | null;
  showOnlyDifferences?: boolean;
  onKitNumberClick?: (kitNumber: string) => void;
  onRemoveMarker?: (marker: string) => void;
}

// Common STR markers in order of importance
const COMMON_STR_MARKERS = [
  'DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385a', 'DYS385b', 'DYS426', 'DYS388',
  'DYS439', 'DYS389I', 'DYS392', 'DYS389II', 'DYS458', 'DYS459a', 'DYS459b', 'DYS455',
  'DYS454', 'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464a', 'DYS464b', 'DYS464c',
  'DYS464d', 'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607', 'DYS576', 'DYS570',
  'CDY', 'DYS442', 'DYS438', 'DYS531', 'DYS578'
];

interface MarkerRarity {
  frequency: number;
  level: 'common' | 'uncommon' | 'rare' | 'very-rare' | 'extremely-rare';
}

const AdvancedMatchesTable: React.FC<AdvancedMatchesTableProps> = ({ matches, query, showOnlyDifferences = false, onKitNumberClick, onRemoveMarker }) => {
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  const [markerFilters, setMarkerFilters] = useState<Record<string, boolean>>({});

  // Calculate marker rarity based on frequency in matches
  const markerRarities = useMemo(() => {
    if (!query || matches.length === 0) return {};

    const rarities: Record<string, Record<string, MarkerRarity>> = {};

    // For each marker in the query
    Object.keys(query.markers).forEach(marker => {
      rarities[marker] = {};
      const queryValue = query.markers[marker];

      // Count how many matches have the same value for this marker
      const matchingCount = matches.filter(match =>
        match.profile?.markers[marker] === queryValue
      ).length;

      const frequency = matchingCount / matches.length;

      let level: MarkerRarity['level'] = 'common';
      if (frequency <= 0.04) level = 'extremely-rare';
      else if (frequency <= 0.08) level = 'very-rare';
      else if (frequency <= 0.15) level = 'rare';
      else if (frequency <= 0.25) level = 'uncommon';

      rarities[marker][queryValue] = { frequency, level };
    });

    return rarities;
  }, [query, matches]);

  // Get visible markers - ONLY show markers that differ in at least one match
  const visibleMarkers = useMemo(() => {
    if (!query) return [];

    const queryMarkers = Object.keys(query.markers);

    // ВСЕГДА показываем только маркеры с различиями
    const relevantMarkers = queryMarkers.filter(marker => {
      const queryValue = query.markers[marker];
      // Показываем маркер только если он отличается хотя бы у одного профиля
      return matches.some(match => {
        const matchValue = match.profile?.markers[marker];
        return matchValue && matchValue !== queryValue;
      });
    });

    // Sort by COMMON_STR_MARKERS order, then alphabetically
    return relevantMarkers.sort((a, b) => {
      const aIndex = COMMON_STR_MARKERS.indexOf(a);
      const bIndex = COMMON_STR_MARKERS.indexOf(b);

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      } else if (aIndex !== -1) {
        return -1;
      } else if (bIndex !== -1) {
        return 1;
      } else {
        return a.localeCompare(b);
      }
    });
  }, [query, matches]);

  // Показываем ВСЕ различающиеся маркеры (без ограничений)
  const displayedMarkers = visibleMarkers;

  const getRarityClass = useCallback((marker: string, value: string) => {
    const rarity = markerRarities[marker]?.[value];
    if (!rarity) return 'bg-gray-100';

    switch (rarity.level) {
      case 'extremely-rare': return 'bg-red-500 text-white';
      case 'very-rare': return 'bg-orange-400 text-white';
      case 'rare': return 'bg-orange-200 text-gray-900';
      case 'uncommon': return 'bg-yellow-100 text-gray-900';
      case 'common': return 'bg-white';
      default: return 'bg-gray-100';
    }
  }, [markerRarities]);

  const toggleMarkerFilter = useCallback((marker: string) => {
    setMarkerFilters(prev => ({
      ...prev,
      [marker]: !prev[marker]
    }));
  }, []);

  // Фильтруем matches по выбранным маркерам
  const filteredMatches = useMemo(() => {
    const activeFilters = Object.entries(markerFilters).filter(([_, active]) => active);

    if (activeFilters.length === 0) {
      return matches;
    }

    return matches.filter(match => {
      return activeFilters.every(([marker, _]) => {
        const queryValue = query?.markers[marker];
        const matchValue = match.profile?.markers[marker];
        return queryValue && matchValue && queryValue === matchValue;
      });
    });
  }, [matches, markerFilters, query]);

  if (!matches || matches.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-6xl text-gray-300 mb-4">🧬</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Matches Found</h3>
          <p className="text-gray-500">Try adjusting your search parameters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Simple Header like in original */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-2">
          🎯 Генетические совпадения ({filteredMatches.length} {filteredMatches.length !== matches.length && `из ${matches.length}`} найдено)
        </h2>
        <p className="text-sm text-gray-600">
          {filteredMatches.length !== matches.length ? (
            <>Отфильтровано {filteredMatches.length} из {matches.length} совпадений</>
          ) : (
            <>Найдено {matches.length} генетических совпадений</>
          )}
        </p>
      </div>

      {/* Matches Table */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="border-collapse" style={{ tableLayout: 'fixed', width: 'auto' }}>
            {/* Beautiful Header */}
            <thead>
              {/* Main header row */}
              <tr className="bg-gradient-to-r from-slate-800 via-blue-900 to-indigo-900 text-white">
                <th className="sticky left-0 bg-gradient-to-r from-slate-800 to-blue-900 border-r border-blue-700 px-2 py-2 text-center z-10 w-[100px] max-w-[100px] font-bold text-sm">
                  Набор
                </th>
                <th className="border-r border-blue-700 px-2 py-2 text-center w-[150px] max-w-[150px] font-bold text-sm">
                  Имя
                </th>
                <th className="border-r border-blue-700 px-2 py-2 text-center w-[120px] max-w-[120px] font-bold text-sm">
                  Страна
                </th>
                <th className="border-r border-blue-700 px-2 py-2 text-center w-[150px] max-w-[150px] font-bold text-sm">
                  Гаплогруппа
                </th>
                <th className="border-r border-blue-700 px-2 py-2 text-center w-[60px] max-w-[60px] font-bold text-sm">
                  ГР
                </th>
                <th className="border-r border-blue-700 px-2 py-2 text-center w-[60px] max-w-[60px] font-bold text-sm">
                  STR
                </th>
                <th className="border-r border-blue-700 px-2 py-2 text-center w-[60px] max-w-[60px] font-bold text-sm">
                  %
                </th>
                {displayedMarkers.map((marker) => (
                  <th key={marker} className="border-r border-blue-700 px-1 pb-2 text-center w-[35px] max-w-[35px] min-w-[35px] font-bold text-xs relative h-[120px]">
                    {/* Кнопка удаления маркера - САМЫЙ ВЕРХ */}
                    {onRemoveMarker && (
                      <button
                        onClick={() => onRemoveMarker(marker)}
                        className="absolute left-1/2 -translate-x-1/2 text-red-600 hover:text-red-800 cursor-pointer font-bold leading-none text-lg"
                        style={{ top: 0, zIndex: 30 }}
                        title={`Удалить маркер ${marker}`}
                      >
                        ×
                      </button>
                    )}
                    {/* Чекбокс для фильтрации - ПОД КРЕСТИКОМ */}
                    <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '24px', zIndex: 10 }}>
                      <input
                        type="checkbox"
                        checked={markerFilters[marker] || false}
                        onChange={() => toggleMarkerFilter(marker)}
                        className="cursor-pointer w-3 h-3"
                        title={`Фильтровать: показать только совпадения по ${marker}`}
                      />
                    </div>
                    {/* Название маркера */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'translateX(-50%) translateY(-50%) rotate(180deg)' }}>
                      {marker}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Match Results */}
            <tbody className="bg-white">
              {/* Query Profile Row */}
              {query && (
                <tr className="bg-blue-100 border-b-2 border-blue-400">
                  <td className="sticky left-0 bg-blue-100 border-r border-gray-300 px-2 py-2 text-center z-10 w-[100px] max-w-[100px]">
                    <span className="font-bold text-blue-800">{query.kitNumber || 'Query'}</span>
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-center w-[150px] max-w-[150px]">
                    <span className="text-sm font-semibold">{query.name || 'Query Profile'}</span>
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-center w-[120px] max-w-[120px]">
                    <span className="text-sm">{query.country || ''}</span>
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-center w-[150px] max-w-[150px]">
                    <span className="text-sm font-mono text-purple-700 font-bold">{query.haplogroup || ''}</span>
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-center w-[60px] max-w-[60px]">
                    <span className="px-2 py-1 rounded text-xs font-bold text-white bg-green-500">0</span>
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-center w-[60px] max-w-[60px]">
                    <span className="text-sm font-semibold">{Object.keys(query.markers).length}</span>
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-center w-[60px] max-w-[60px]">
                    <span className="text-sm font-bold text-green-600">100.0</span>
                  </td>
                  {displayedMarkers.map((marker) => {
                    const queryValue = query.markers[marker];
                    if (!queryValue) {
                      return (
                        <td key={marker} className="border-r border-gray-300 px-0.5 py-2 text-center w-[35px] max-w-[35px] min-w-[35px]">
                          <span className="text-gray-400 text-xs">-</span>
                        </td>
                      );
                    }
                    const rarityClass = getRarityClass(marker, queryValue);
                    return (
                      <td key={marker} className="border-r border-gray-300 px-0.5 py-2 text-center w-[35px] max-w-[35px] min-w-[35px]">
                        <div className={`text-xs font-bold px-0.5 py-1 rounded ${rarityClass || 'bg-white'}`} title={`${marker}: ${queryValue}`}>
                          <span>-</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              )}

              {filteredMatches.map((match, index) => (
                <tr
                  key={match.profile?.kitNumber || index}
                  className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  {/* Kit Number */}
                  <td className="sticky left-0 bg-inherit border-r border-gray-300 px-2 py-2 text-center z-10 w-[100px] max-w-[100px]">
                    {onKitNumberClick ? (
                      <button
                        onClick={() => match.profile?.kitNumber && onKitNumberClick(match.profile.kitNumber)}
                        className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                        title="Click to search matches for this profile"
                      >
                        {match.profile?.kitNumber || 'N/A'}
                      </button>
                    ) : (
                      <span className="font-bold text-blue-600">
                        {match.profile?.kitNumber || 'N/A'}
                      </span>
                    )}
                  </td>

                  {/* Name */}
                  <td className="border-r border-gray-300 px-2 py-2 text-center w-[150px] max-w-[150px]">
                    <span className="text-sm">
                      {match.profile?.name || ''}
                    </span>
                  </td>

                  {/* Country */}
                  <td className="border-r border-gray-300 px-2 py-2 text-center w-[120px] max-w-[120px]">
                    <span className="text-sm">
                      {match.profile?.country || ''}
                    </span>
                  </td>

                  {/* Haplogroup */}
                  <td className="border-r border-gray-300 px-2 py-2 text-center w-[150px] max-w-[150px]">
                    <span className="text-sm font-mono text-purple-600">
                      {match.profile?.haplogroup || ''}
                    </span>
                  </td>

                  {/* Genetic Distance */}
                  <td className="border-r border-gray-300 px-2 py-2 text-center w-[60px] max-w-[60px]">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold text-white ${
                        match.distance === 0
                          ? 'bg-green-500'
                          : match.distance <= 2
                          ? 'bg-blue-500'
                          : match.distance <= 5
                          ? 'bg-orange-500'
                          : 'bg-red-500'
                      }`}
                    >
                      {match.distance}
                    </span>
                  </td>

                  {/* STR Count */}
                  <td className="border-r border-gray-300 px-2 py-2 text-center w-[60px] max-w-[60px]">
                    <span className="text-sm font-semibold">
                      {match.comparedMarkers}
                    </span>
                  </td>

                  {/* Match Percentage */}
                  <td className="border-r border-gray-300 px-2 py-2 text-center w-[60px] max-w-[60px]">
                    <span className="text-sm font-bold text-green-600">
                      {typeof match.percentIdentical === 'number'
                        ? `${match.percentIdentical.toFixed(1)}`
                        : `${match.percentIdentical}`}
                    </span>
                  </td>

                  {/* Marker values with differences */}
                  {displayedMarkers.map((marker) => {
                    const queryValue = query?.markers[marker];
                    const matchValue = match.profile?.markers[marker];

                    if (!matchValue || !queryValue) {
                      return (
                        <td key={marker} className="border-r border-gray-300 px-0.5 py-2 text-center w-[35px] max-w-[35px] min-w-[35px]">
                          <span className="text-gray-400 text-xs">-</span>
                        </td>
                      );
                    }

                    const isPalindrome = marker in palindromes;
                    const diff = calculateMarkerDifference(queryValue, matchValue, marker, isPalindrome, { type: 'standard' });
                    const rarityClass = getRarityClass(marker, queryValue);

                    return (
                      <td key={marker} className="border-r border-gray-300 px-0.5 py-2 text-center w-[35px] max-w-[35px] min-w-[35px]">
                        <div
                          className={`text-xs font-bold px-0.5 py-1 rounded ${
                            diff === 0
                              ? rarityClass || 'bg-white'
                              : 'bg-white'
                          }`}
                          title={`${marker}: ${matchValue}`}
                        >
                          {!isNaN(diff) && diff > 0 ? (
                            <span className={diff === 1 ? 'text-orange-600' : diff === 2 ? 'text-red-600' : 'text-red-800'}>
                              {Number(matchValue) > Number(queryValue) ? `+${diff}` : `-${diff}`}
                            </span>
                          ) : (
                            <span>-</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Beautiful Legend */}
      <div className="bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900 rounded-2xl p-6 border border-blue-700/50 shadow-2xl">
        <h4 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-yellow-400">📊</span>
          Legend & Guide
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h5 className="font-bold text-sm text-blue-200 mb-3 flex items-center gap-2">
              <span>🎯</span>
              Genetic Distance:
            </h5>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl text-sm font-bold shadow-lg">0 Perfect</span>
              <span className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg">1-2 Close</span>
              <span className="px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-bold shadow-lg">3-5 Moderate</span>
              <span className="px-3 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl text-sm font-bold shadow-lg">6+ Distant</span>
            </div>
          </div>
          <div>
            <h5 className="font-bold text-sm text-purple-200 mb-3 flex items-center gap-2">
              <span>🧬</span>
              Marker Rarity:
            </h5>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-2 bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg">≤4% Ultra Rare</span>
              <span className="px-3 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold shadow-lg">≤8% Very Rare</span>
              <span className="px-3 py-2 bg-orange-300 text-gray-900 rounded-xl text-sm font-bold shadow-lg">≤15% Rare</span>
              <span className="px-3 py-2 bg-yellow-200 text-gray-900 rounded-xl text-sm font-bold shadow-lg">≤25% Uncommon</span>
              <span className="px-3 py-2 bg-green-100 text-gray-900 rounded-xl text-sm font-bold shadow-lg">&gt;25% Common</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedMatchesTable;