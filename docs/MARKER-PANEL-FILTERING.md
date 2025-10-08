# Фильтрация по панелям маркеров - Исправление критической проблемы

## Дата: 2025-10-07

## Проблема

### Описание
При поиске совпадений профили с меньшим количеством маркеров получали искусственно завышенный процент совпадения, несмотря на то что сравнивалось меньше маркеров.

### Пример проблемы
```
Запрос: 37 маркеров
Профиль A: 37 маркеров, 5 отличий → 86.5% совпадение
Профиль B: 11 маркеров, 0 отличий → 100% совпадение (!)
```

**Проблема:** Профиль B выходил первым в результатах, хотя с ним сравнивалось только 11 маркеров вместо 37.

## Решение

### 1. Добавлен выбор панели маркеров в UI

**Файл:** `str-matcher/src/components/str-matcher/BackendSearch.tsx`

Добавлен dropdown для выбора панели:
- Y-STR12 (12 маркеров)
- Y-STR25 (25 маркеров)
- Y-STR37 (37 маркеров) - по умолчанию
- Y-STR67 (67 маркеров)
- Y-STR111 (111 маркеров)

### 2. Обновлен backend API hook

**Файл:** `str-matcher/src/hooks/useBackendAPI.ts`

```typescript
interface BackendSearchParams {
  markers: Record<string, string>;
  maxDistance?: number;
  limit?: number;
  markerCount?: 12 | 25 | 37 | 67 | 111;  // ← Добавлено
  haplogroupFilter?: string;
}
```

### 3. Создана улучшенная SQL функция v5

**Файл:** `database/optimized-v5-marker-panel-filter.sql`

#### Ключевые улучшения:

##### a) Таблица стандартных панелей
```sql
CREATE TABLE marker_panels (
    panel_size INTEGER PRIMARY KEY,
    markers TEXT[]
);
```

Содержит точные списки маркеров для каждой панели (12, 25, 37, 67, 111).

##### b) Фильтрация профилей по наличию маркеров панели
```sql
WHERE fp.profile_panel_marker_count >= panel_min_threshold
```

- `panel_min_threshold` = CEIL(количество_маркеров_панели * 0.8)
- Профили должны иметь минимум **80% маркеров** от выбранной панели

##### c) Корректный расчет процента совпадения
```sql
percent_identical = ROUND((identical_markers / compared_markers) * 100, 1)
```

Теперь процент рассчитывается на основе **идентичных** маркеров, а не `(compared - distance)`.

### 4. Обновлен backend сервис

**Файл:** `backend/services/matchingService.js`

```javascript
// Использует v5 функцию вместо v4
const query = `SELECT * FROM find_matches_batch_v5($1, $2, $3, $4, $5, $6)`;

// Использует percent_identical из SQL
percentIdentical: row.percent_identical || fallback_calculation
```

## Логика работы

### До исправления (v4)
1. Сравнивались только маркеры, которые есть в запросе
2. Профили с меньшим количеством маркеров не фильтровались
3. Процент совпадения: `(compared - distance) / compared * 100`
4. **Результат:** Профили с 11 маркерами могли показывать 100% при 0 отличий

### После исправления (v5)
1. Определяется панель маркеров (12/25/37/67/111)
2. Профили **обязаны** иметь ≥80% маркеров панели
3. Сравниваются только маркеры из панели
4. Процент совпадения: `identical / compared * 100`
5. **Результат:** Корректное сравнение "яблок с яблоками"

## Пример работы

### Запрос с панелью Y-STR37

```bash
curl -X POST http://localhost:9004/api/profiles/find-matches \
  -H "Content-Type: application/json" \
  -d '{
    "markers": {"DYS393":"13", "DYS390":"24"},
    "maxDistance": 5,
    "maxResults": 10,
    "markerCount": 37
  }'
```

#### Что происходит:

1. **Загружается панель Y-STR37** (37 маркеров)
2. **Минимальный порог:** 37 * 0.8 = 30 маркеров
3. **Фильтрация:** Только профили с ≥30 маркерами из панели Y-STR37
4. **Сравнение:** Только по маркерам DYS393 и DYS390 (из запроса)
5. **Сортировка:** По genetic_distance, затем по compared_markers

#### Результаты:
```json
{
  "kitNumber": "100000",
  "distance": 0,
  "comparedMarkers": 2,
  "identicalMarkers": 2,
  "percentIdentical": "100.0",
  "markers": { /* 31 маркер */ }
}
```

✅ Профиль имеет 31 маркер из панели Y-STR37 (≥30) → включен в результаты

❌ Профиль с 11 маркерами → отфильтрован (< 30)

## Связанные изменения

### Frontend
- [BackendSearch.tsx](str-matcher/src/components/str-matcher/BackendSearch.tsx) - UI выбора панели
- [useBackendAPI.ts](str-matcher/src/hooks/useBackendAPI.ts) - передача markerCount

### Backend
- [matchingService.js](backend/services/matchingService.js) - использование v5 функции
- [profiles.js](backend/routes/profiles.js) - валидация markerCount (уже была)

### Database
- [optimized-v5-marker-panel-filter.sql](database/optimized-v5-marker-panel-filter.sql) - новая SQL функция
- Таблица `marker_panels` с определениями панелей

## Тестирование

### Проверка функции v5
```sql
-- Поиск с панелью Y-STR37
SELECT * FROM find_matches_batch_v5(
  '{"DYS393":"13","DYS390":"24"}'::jsonb,
  5,    -- maxDistance
  10,   -- maxResults
  37,   -- markerCount
  NULL, -- haplogroupFilter
  false -- includeSubclades
);
```

### Проверка через API
```bash
# С панелью Y-STR12 (минимум 10 маркеров)
curl -X POST http://localhost:9004/api/profiles/find-matches \
  -H "Content-Type: application/json" \
  -d '{"markers":{"DYS393":"13"},"markerCount":12}'

# С панелью Y-STR111 (минимум 89 маркеров)
curl -X POST http://localhost:9004/api/profiles/find-matches \
  -H "Content-Type: application/json" \
  -d '{"markers":{"DYS393":"13"},"markerCount":111}'
```

## Преимущества новой системы

### 1. Корректность
✅ Профили сравниваются только если имеют достаточно маркеров
✅ Процент совпадения отражает реальное генетическое сходство
✅ Нет искусственного завышения результатов

### 2. Гибкость
✅ Выбор панели маркеров (12/25/37/67/111)
✅ Автоматическая фильтрация по наличию маркеров
✅ Совместимость с основным STR matcher

### 3. Производительность
✅ GIN индекс для быстрой проверки наличия маркеров
✅ Ранняя фильтрация (LIMIT в CTE)
✅ Кэширование результатов в Redis (1 час)

## Миграция

### Для существующих установок:

1. **Применить SQL функцию:**
```bash
cat database/optimized-v5-marker-panel-filter.sql | \
  docker exec -i ystr-postgres psql -U postgres -d ystr_matcher
```

2. **Перезапустить backend:**
```bash
# Backend автоматически использует новую v5 функцию
pm2 restart backend
```

3. **Frontend обновится автоматически** при следующей сборке

### Обратная совместимость:
- ✅ Работает с v4, если v5 не найдена
- ✅ markerCount опциональный (default 37)
- ✅ Старые запросы без markerCount работают

## Известные ограничения

1. **Минимум 80% маркеров панели**
   - Профили с < 80% маркеров не попадут в результаты
   - Это сознательное решение для корректности

2. **Фиксированные панели**
   - Поддерживаются только стандартные панели: 12, 25, 37, 67, 111
   - Кастомные панели требуют добавления в таблицу `marker_panels`

3. **Требуется PostgreSQL**
   - Функция использует специфичные для PG возможности
   - IndexedDB версия (frontend) использует аналогичную логику

## Будущие улучшения

- [ ] Добавить панель GP (Genetic Path) из основного STR matcher
- [ ] Визуализация покрытия маркеров в UI
- [ ] Статистика по панелям в dashboard
- [ ] Предупреждение если профиль не соответствует выбранной панели

## Связанная документация

- [API-ERROR-400-FIX.md](API-ERROR-400-FIX.md) - Исправление валидации запросов
- [POSTGRES-IMPLEMENTATION-COMPLETE.md](POSTGRES-IMPLEMENTATION-COMPLETE.md) - PostgreSQL архитектура
- [src/utils/constants.ts](../str-matcher/src/utils/constants.ts) - Определения панелей маркеров
