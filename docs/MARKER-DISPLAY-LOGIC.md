# Логика отображения маркеров в таблице совпадений

## Дата: 2025-10-07

## Принцип работы

Таблица показывает **только те маркеры, по которым есть различия** хотя бы у одного профиля в результатах поиска.

### Примеры:

#### Пример 1: Полное совпадение
- **Query профиль**: 39666
- **Match профиль**: 100000 (все маркеры совпадают)
- **ГР = 0**
- **Отображение**: Колонки с маркерами НЕ показываются (все совпадают)

#### Пример 2: Одно различие
- **Query профиль**: 39666
- **Match профиль**: 100001 (отличается только DYS393)
- **ГР = 1**
- **Отображение**: Показывается только колонка DYS393 с различием

#### Пример 3: Множественные совпадения
- **Query профиль**: 39666
- **Match профили**: 111288 (ГР=7), 144637 (ГР=10), 128043 (ГР=11)
- **Отображение**: Показываются только те маркеры, по которым хотя бы один из профилей отличается от query

### Проверка корректности

**Важно:** Сумма различий по маркерам в строке должна совпадать со значением ГР для этого профиля.

Для профиля 111288 (ГР=7):
- CDY: 33-34 vs 33-37 → +2 (палиндром)
- DYS449: 28 vs 27 → +1
- DYS456: 16 vs 17 → +1
- DYS458: 16 vs 17 → +1
- DYS576: 18 vs 17 → +1
- DYS389ii: 28 vs 29 → +1
- **Сумма: 2+1+1+1+1+1 = 7** ✓

## Расчёт генетической дистанции (ГР)

### Режим Standard (текущий)

Используется для фильтрации и отображения:

1. **Обычные маркеры**: Разница ограничена до ±2
   - Пример: DYS393: 13 vs 20 → расстояние = 2 (не 7)

2. **Палиндромные маркеры** (CDY, DYS385, DYS459, DYS464, YCAII, etc):
   - Каждый компонент ограничен до ±2
   - Общая сумма тоже ограничена до 2
   - Пример: CDY: 33-34 vs 33-37 → (0 + min(3,2)) → min(2, 2) = 2

### SQL функции

- `calculate_marker_distance(val1, val2)` - Standard mode (с ограничениями)
- `calculate_marker_distance_extended(val1, val2)` - Extended mode (без ограничений, создана но не используется)

### PostgreSQL функции

- **v5**: `find_matches_batch_v5` - текущая версия
  - Фильтрация по панелям маркеров (Y-STR12, Y-STR25, Y-STR37, Y-STR67, Y-STR111)
  - Требование: профиль должен иметь ≥80% маркеров из выбранной панели
  - Использует standard distance для фильтрации

- **v6**: `find_matches_batch_v6` - экспериментальная (не используется)
  - Возвращает два значения GD: standard и extended
  - Не активирована из-за проблем с производительностью

## Реализация в коде

### Frontend: AdvancedMatchesTable.tsx

```typescript
// Получаем только маркеры с различиями
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

  // Сортировка по COMMON_STR_MARKERS порядку
  return relevantMarkers.sort(...);
}, [query, matches]);
```

### Backend: matchingService.js

```javascript
// Используем v5 функцию
const query = `SELECT * FROM find_matches_batch_v5($1, $2, $3, $4, $5, $6)`;

const params = [
  JSON.stringify(queryMarkers),
  maxDistance,
  maxResults,
  markerCount,  // 12, 25, 37, 67, или 111
  haplogroupFilter,
  includeSubclades
];
```

### Database: optimized-v5-marker-panel-filter.sql

```sql
-- Фильтрация профилей по панели маркеров
WITH filtered_profiles AS (
  SELECT
    p.*,
    (
      SELECT COUNT(*)::INTEGER
      FROM unnest(panel_markers) pm
      WHERE p.markers->>pm IS NOT NULL AND p.markers->>pm != ''
    ) as profile_panel_marker_count
  FROM ystr_profiles p
  WHERE p.markers ?& query_marker_keys
),
distances AS (
  SELECT
    fp.*,
    (
      SELECT SUM(calculate_marker_distance(query_markers->>k, fp.markers->>k))::INTEGER
      FROM unnest(query_marker_keys) k
      WHERE fp.markers->>k IS NOT NULL AND fp.markers->>k != ''
    ) as distance
  FROM filtered_profiles fp
  -- КРИТИЧНО: только профили с ≥80% маркеров панели
  WHERE fp.profile_panel_marker_count >= panel_min_threshold
)
SELECT * FROM distances
WHERE distance <= max_distance
ORDER BY distance ASC
LIMIT max_results;
```

## Панели маркеров

Таблица `marker_panels` содержит определения стандартных панелей:

| panel_size | markers_count | description |
|------------|---------------|-------------|
| 12 | 12 | Y-STR12 базовая панель |
| 25 | 25 | Y-STR25 расширенная |
| 37 | 36 | Y-STR37 стандартная (на самом деле 36 маркеров) |
| 67 | 67 | Y-STR67 большая |
| 111 | 111 | Y-STR111 максимальная |

### Требование 80%

Профиль включается в результаты только если имеет заполненными минимум 80% маркеров из выбранной панели:

- Y-STR37 (36 маркеров): требуется ≥29 заполненных
- Y-STR67 (67 маркеров): требуется ≥54 заполненных
- Y-STR111 (111 маркеров): требуется ≥89 заполненных

## Кэширование

### Redis кэш
- TTL: 1 час (3600 секунд)
- Ключ: `match:${base64(query_params)}`
- Очистка: автоматическая при bulk insert или вручную

### Очистка кэша

```bash
docker exec ystr-backend node -e "const Redis = require('redis'); const client = Redis.createClient({url: 'redis://redis:6379'}); client.connect().then(async () => { const keys = await client.keys('match:*'); if (keys.length > 0) await client.del(keys); console.log('Cache cleared'); await client.quit(); });"
```

## Известные проблемы и решения

### Проблема 1: Профили с малым количеством маркеров
**Решено**: v5 функция фильтрует профили по правилу 80% панели

### Проблема 2: Палиндромные маркеры считались неправильно
**Решено**: Функция `calculate_marker_distance` корректно обрабатывает палиндромы с ограничениями

### Проблема 3: Показывались все маркеры (102+)
**Решено**: Теперь показываются только маркеры с различиями

## Тестирование

### Тест 1: Профиль с достаточным количеством маркеров
```bash
curl -X POST http://localhost:9004/api/profiles/find-matches \
  -H "Content-Type: application/json" \
  -d '{"markers":{"DYS393":"13"},"maxDistance":25,"maxResults":150,"markerCount":37}'
```

Результат: Профили с ≥29 маркерами из Y-STR37

### Тест 2: Профиль с недостаточным количеством маркеров
Профиль N75201 (11 маркеров) НЕ должен появляться в результатах при markerCount=37

### Тест 3: Проверка GD
```sql
SELECT
  'CDY' as marker,
  '33-34' as query,
  '33-37' as match,
  calculate_marker_distance('33-34', '33-37') as distance;
```

Ожидаемый результат: distance = 2

## История изменений

- **2025-10-07**: Реализована логика отображения только различающихся маркеров
- **2025-10-07**: Исправлен расчёт GD для палиндромов
- **2025-10-07**: Добавлена фильтрация по панелям маркеров (v5)
- **2025-10-07**: Исправлена проблема с профилями с малым количеством маркеров
