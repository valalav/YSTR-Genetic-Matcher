import { markerGroups, palindromes } from './constants';
import type { STRMatch, MarkerCount } from './constants';
import type { Profile } from '@/types/profile';
import type { HaplogroupFilter } from '@/types/haplogroup';
import axios from 'axios';
import { Match, Filters } from '../types';

export interface CalculationMode {
  type: 'standard' | 'extended';
}

// ⚡ КЭШИРОВАНИЕ: Результаты проверки гаплогрупп
const haplogroupCache = new Map<string, boolean>();
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 час
const cacheTimestamps = new Map<string, number>();

// ⚡ МЕМОИЗАЦИЯ: Кэш результатов редкости маркеров
const rarityCache = new Map<string, { rarity: number; rarityStyle?: React.CSSProperties; timestamp: number }>();
const RARITY_CACHE_EXPIRY = 5 * 60 * 1000; // 5 минут

export function normalizeMarkerValue(value: string | number): number {
  if (typeof value === 'undefined' || value === null || value === '') return NaN;
  return parseInt(String(value).trim());
}

export function calculateMarkerDifference(
  value1: string,
  value2: string,
  marker: string,
  isPalindrome?: boolean,
  mode: CalculationMode = { type: 'standard' }
): number {
  if (!value1 || !value2) return 0;

  // Simple string comparison (matches PostgreSQL calculate_marker_distance logic)
  // This ensures consistency between frontend display and backend calculations
  if (value1 === value2) {
    return 0;
  }

  if (!isPalindrome) {
    const val1 = normalizeMarkerValue(value1);
    const val2 = normalizeMarkerValue(value2);
    if (isNaN(val1) || isNaN(val2)) return 1; // Different non-numeric values

    // For standard markers - return the absolute difference, capped at 2 (FTDNA standard)
    return Math.min(Math.abs(val2 - val1), 2);
  }

  // For palindromic markers - if strings differ, return 1
  // This matches the PostgreSQL behavior where palindromic markers count as 1 marker
  return 1;
}
export interface GeneticDistanceResult {
  distance: number;
  comparedMarkers: number;
  identicalMarkers: number;
  percentIdentical: number;
  hasAllRequiredMarkers: boolean;
}

export function calculateGeneticDistance(
  profile1: Record<string, string>,
  profile2: Record<string, string>, 
  selectedMarkerCount: MarkerCount,
  mode: CalculationMode = { type: 'standard' }
): GeneticDistanceResult {
  // Get markers based on selected count
  const markersToCompare = typeof selectedMarkerCount === 'string' && selectedMarkerCount === 'GP' 
    ? markerGroups.GP 
    : markerGroups[selectedMarkerCount];
  
  const activeMarkers = markersToCompare.filter(marker => 
    marker in profile1 && profile1[marker]?.trim()
  );

  const minRequired = Math.ceil(activeMarkers.length * 0.8);
  
  let totalDistance = 0;
  let comparedCount = 0;
  let identicalCount = 0;

  // Сначала собираем все значения для полиндромов
  const palindromeValues: Record<string, { values1: string, values2: string }> = {};
  
  for (const marker of activeMarkers) {
    const value1 = profile1[marker]?.trim();
    const value2 = profile2[marker]?.trim();

    if (!value1 || !value2) continue;

    comparedCount++;
    
    // Определяем базовое имя маркера
    const baseMarker = marker.replace(/[ab]$/, '');
    const isPalindrome = baseMarker in palindromes;

    if (isPalindrome) {
      // Для полиндромов собираем значения
      if (!palindromeValues[baseMarker]) {
        palindromeValues[baseMarker] = { values1: value1, values2: value2 };
      } else {
        palindromeValues[baseMarker].values1 += `-${value1}`;
        palindromeValues[baseMarker].values2 += `-${value2}`;
      }
    } else {
      // Для обычных маркеров считаем разницу сразу
      const diff = calculateMarkerDifference(value1, value2, marker, false, mode);
      if (!isNaN(diff)) {
        totalDistance += diff;
        if (diff === 0) {
          identicalCount++;
        }
      }
    }
  }

  // Теперь обрабатываем полиндромы
  for (const [baseMarker, { values1, values2 }] of Object.entries(palindromeValues)) {
    const diff = calculateMarkerDifference(values1, values2, baseMarker, true, mode);
    if (!isNaN(diff)) {
      totalDistance += diff;
      if (diff === 0) {
        identicalCount++;
      }
    }
  }

  if (comparedCount < minRequired) {
    return {
      distance: 0,
      comparedMarkers: comparedCount,
      identicalMarkers: identicalCount,
      percentIdentical: 0,
      hasAllRequiredMarkers: false
    };
  }

  return {
    distance: totalDistance,
    comparedMarkers: comparedCount,
    identicalMarkers: identicalCount,
    percentIdentical: (identicalCount / comparedCount) * 100,
    hasAllRequiredMarkers: true
  };
}
export interface MarkerRarityResult {
  rarity: number;
  rarityStyle?: React.CSSProperties;
}

// ⚡ ОПТИМИЗИРОВАННАЯ ФУНКЦИЯ: Редкость маркеров с мемоизацией
export function calculateMarkerRarity(
  matches: STRMatch[],
  marker: string,
  value: string,
  queryValue: string
): MarkerRarityResult {
  // Skip calculation if values don't match
  if (value !== queryValue) {
    return { rarity: 0, rarityStyle: undefined };
  }

  const totalProfiles = matches.length;
  if (totalProfiles < 5) return { rarity: 0, rarityStyle: undefined };

  // ⚡ КЭШИРОВАНИЕ: Проверяем кэш результатов
  const cacheKey = `${marker}_${value}_${totalProfiles}`;
  const cached = rarityCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < RARITY_CACHE_EXPIRY) {
    return { rarity: cached.rarity, rarityStyle: cached.rarityStyle };
  }

  // ⚡ ОПТИМИЗАЦИЯ: Быстрый подсчет с ранним выходом
  let matchingCount = 0;
  for (const match of matches) {
    if (match.profile.markers[marker] === value) {
      matchingCount++;
    }
  }

  const percentage = (matchingCount / totalProfiles) * 100;

  // Set background color based on rarity
  let backgroundColor;
  let rarityStyle: React.CSSProperties | undefined;
  
  if (percentage <= 4) backgroundColor = 'var(--rarity-1)';
  else if (percentage <= 8) backgroundColor = 'var(--rarity-2)';
  else if (percentage <= 12) backgroundColor = 'var(--rarity-3)';
  else if (percentage <= 20) backgroundColor = 'var(--rarity-4)';
  else if (percentage <= 33) backgroundColor = 'var(--rarity-5)';
  else {
    // ⚡ Кэшируем результат без стиля
    const result = { rarity: percentage, rarityStyle: undefined };
    rarityCache.set(cacheKey, { ...result, timestamp: Date.now() });
    return result;
  }

  rarityStyle = {
    backgroundColor,
    color: backgroundColor === 'var(--rarity-5)' ? 'var(--text-primary)' : 'white',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  // ⚡ Кэшируем результат
  const result = { rarity: percentage, rarityStyle };
  rarityCache.set(cacheKey, { ...result, timestamp: Date.now() });
  
  return result;
}

export const calculateDistance = (
  markers1: Record<string, string>,
  markers2: Record<string, string>
): number => {
  // TODO: Реализовать расчет генетического расстояния
  return 0;
};
export const findMatches = (
  query: Profile,
  database: Profile[],
  options: {
    maxDistance: number,
    markerCount: MarkerCount,
    haplogroupFilter?: HaplogroupFilter
  }
) => {
  let matches = database.filter(profile => {
    // Сначала проверяем количество маркеров
    const geneticResult = calculateGeneticDistance(query.markers, profile.markers, options.markerCount);
    
    // Если у профиля недостаточно маркеров - пропускаем его
    if (!geneticResult.hasAllRequiredMarkers) {
      return false;
    }

    // Проверяем генетическую дистанцию
    if (geneticResult.distance > options.maxDistance) {
      return false;
    }
    
    // Фильтрация по гаплогруппам
    if (options.haplogroupFilter) {
      const { includeGroups, excludeGroups, includeSubclades } = options.haplogroupFilter;
      
      // Проверяем исключения
      if (excludeGroups.some((group: string) => 
        isHaplogroupMatch(profile.haplogroup || '', group, includeSubclades)
      )) {
        return false;
      }
      
      // Проверяем включения
      if (includeGroups.length && !includeGroups.some((group: string) =>
        isHaplogroupMatch(profile.haplogroup || '', group, includeSubclades)
      )) {
        return false;
      }
    }
    
    return true;
  });
  
  return matches;
};

const isHaplogroupMatch = (
  profileHaplogroup: string,
  filterHaplogroup: string,
  includeSubclades: boolean
): boolean => {
  if (!includeSubclades) {
    return profileHaplogroup === filterHaplogroup;
  }
  
  return profileHaplogroup.startsWith(filterHaplogroup);
};
// ⚡ КРИТИЧЕСКАЯ ОПТИМИЗАЦИЯ: Batch API вызовы вместо индивидуальных HTTP запросов
// ⚡ КРИТИЧЕСКАЯ ОПТИМИЗАЦИЯ: Batch API вызовы вместо индивидуальных HTTP запросов
export async function processMatches(matches: Match[], filters: Filters): Promise<Match[]> {
    if (filters.haplogroups.length === 0) return matches;

    console.log(`🚀 Оптимизированная обработка ${matches.length} матчей для ${filters.haplogroups.length} гаплогрупп`);

    const uniqueHaplogroups = new Set<string>();
    const matchesWithHaplogroups = matches.filter(match => {
        if (!match.haplogroup) return false;
        uniqueHaplogroups.add(match.haplogroup);
        return true;
    });

    if (uniqueHaplogroups.size === 0) return [];

    try {
        // ПЕРВЫЙ ШАГ: ВСЕГДА получаем субклады (дочерние) через batch API
        const batchPayload = {
            haplogroups: Array.from(uniqueHaplogroups),
            parentHaplogroups: filters.haplogroups
        };

        console.log(`📡 Отправляем batch запрос для ${uniqueHaplogroups.size} уникальных гаплогрупп`);

        const response = await axios.post<{ results: Record<string, boolean> }>(`/api/batch-check-subclades`, batchPayload);
        const results = response.data.results;

        // Получаем субклады (дети)
        const subcladeMatches = matchesWithHaplogroups.filter(match => {
            if (!match.haplogroup) return false;
            return results[match.haplogroup] === true;
        });

        console.log(`✅ Найдено ${subcladeMatches.length} субкладов через batch API`);

        // ВТОРОЙ ШАГ: Если showEmptyHaplogroups=true, ДОБАВЛЯЕМ родителей
        if (filters.showEmptyHaplogroups) {
            console.log(`🌳 Добавляем родительские гаплогруппы через haplotree`);

            // Получаем полный путь предков для каждой гаплогруппы фильтра
            const ancestorSets = new Map<string, Set<string>>();

            for (const filterHaplo of filters.haplogroups) {
                try {
                    const response = await axios.get(`/api/haplogroup-path/${filterHaplo}`);

                    // Извлекаем предков из FTDNA дерева (с вариантами)
                    const ftdnaNodes = response.data?.ftdnaDetails?.path?.nodes || [];
                    const ftdnaAncestors = ftdnaNodes.flatMap((node: any) => {
                        const names = [node.name];
                        // Добавляем все варианты с префиксом J-
                        if (node.variants && Array.isArray(node.variants)) {
                            names.push(...node.variants.map((v: string) => `J-${v}`));
                        }
                        return names.filter((name: string) => name);
                    });

                    // Извлекаем предков из YFull дерева (с вариантами)
                    const yfullNodes = response.data?.yfullDetails?.path?.nodes || [];
                    const yfullAncestors = yfullNodes.flatMap((node: any) => {
                        const names = [node.name];
                        // Добавляем все варианты с префиксом J-
                        if (node.variants && Array.isArray(node.variants)) {
                            names.push(...node.variants.map((v: string) => `J-${v}`));
                        }
                        return names.filter((name: string) => name);
                    });

                    // Объединяем оба дерева и добавляем сам фильтр
                    const ancestors = new Set<string>([...ftdnaAncestors, ...yfullAncestors, filterHaplo]);

                    ancestorSets.set(filterHaplo, ancestors);
                    console.log(`📍 🔥 VARIANT SUPPORT ENABLED 🔥 ${filterHaplo} имеет ${ancestors.size} предков (FTDNA: ${ftdnaAncestors.length}, YFull: ${yfullAncestors.length})`);
                } catch (error) {
                    console.error(`❌ Ошибка получения haplotree для ${filterHaplo}:`, error);
                    ancestorSets.set(filterHaplo, new Set());
                }
            }

            // Находим родительские матчи (которые не являются субкладами)
            const alreadyIncludedKits = new Set(subcladeMatches.map(m => m.id));
            const parentMatches = matchesWithHaplogroups.filter(match => {
                if (!match.haplogroup) return false;
                if (alreadyIncludedKits.has(match.id)) return false; // Уже включен как субклад

                // Проверяем: является ли гаплогруппа матча предком любого фильтра?
                for (const [filterHaplo, ancestors] of ancestorSets.entries()) {
                    if (ancestors.has(match.haplogroup)) {
                        console.log(`✅ ${match.haplogroup} IS parent of ${filterHaplo} (добавлен)`);
                        return true;
                    }
                }

                return false;
            });

            console.log(`✅ Найдено ${parentMatches.length} родительских гаплогрупп`);

            // ОБЪЕДИНЯЕМ субклады + родителей
            const combinedMatches = [...subcladeMatches, ...parentMatches];
            console.log(`✅ ИТОГО: ${combinedMatches.length} матчей (${subcladeMatches.length} субкладов + ${parentMatches.length} родителей)`);
            return combinedMatches;
        }

        // Обычная логика (без showEmptyHaplogroups): возвращаем только субклады
        console.log(`✅ Возвращаем только субклады: ${subcladeMatches.length} матчей`);
        return subcladeMatches;

    } catch (error) {
        console.error('❌ Ошибка API, используем резервный метод:', error);
        return await processMatchesWithCache(matchesWithHaplogroups, filters);
    }
}

// ⚡ РЕЗЕРВНЫЙ МЕТОД: Оптимизированные индивидуальные запросы с кэшированием
async function processMatchesWithCache(matches: Match[], filters: Filters): Promise<Match[]> {
    const filteredMatches: Match[] = [];
    let cacheHits = 0;
    let apiCalls = 0;

    for (const match of matches) {
        if (!match.haplogroup) continue;

        let include = false;
        
        for (const filterHaplo of filters.haplogroups) {
            const cacheKey = `${match.haplogroup}_${filterHaplo}`;
            
            // ⚡ ПРОВЕРЯЕМ КЭШ
            const cached = haplogroupCache.get(cacheKey);
            const timestamp = cacheTimestamps.get(cacheKey);
            
            if (cached !== undefined && timestamp && (Date.now() - timestamp) < CACHE_EXPIRY) {
                cacheHits++;
                if (cached) {
                    include = true;
                    break;
                }
                continue;
            }

            // ⚡ ДЕЛАЕМ API ЗАПРОС только если нет в кэше
            try {
                apiCalls++;
                // Используем относительный путь - Next.js проксирует к API серверу
                const response = await axios.post<{ isSubclade: boolean }>(`/api/check-subclade`, {
                    haplogroup: match.haplogroup,
                    parentHaplogroup: filterHaplo
                });
                
                const result = response.data.isSubclade;
                
                // ⚡ КЭШИРУЕМ результат
                haplogroupCache.set(cacheKey, result);
                cacheTimestamps.set(cacheKey, Date.now());
                
                if (result) {
                    include = true;
                    break;
                }
            } catch (error) {
                console.error('Error checking subclade:', error);
            }
        }
        
        if (include) {
            filteredMatches.push(match);
        }
    }

    console.log(`📊 Резервная обработка: ${cacheHits} cache hits, ${apiCalls} API calls`);
    return filteredMatches;
}

// ⚡ СЛУЖЕБНАЯ ФУНКЦИЯ: Очистка кэша
export function clearHaplogroupCache(): void {
    haplogroupCache.clear();
    cacheTimestamps.clear();
    rarityCache.clear();
    console.log('🗑️ Кэш гаплогрупп и редкости очищен');
}